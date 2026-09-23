package com.sgologic.integration;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * El repartidor del outbox: hace de broker del MVP. Cada cierto tiempo toma los eventos
 * pendientes y se los entrega a su manejador; si el manejador falla, el evento vuelve a la cola
 * con una espera que se duplica en cada intento (1s, 2s, 4s, 8s...) y, al agotarse, queda como
 * FAILED con su último error, visible en {@code GET /api/integration/outbox}.
 *
 * <p>Nada de esto corre en el hilo de la petición del cliente: por eso una caída de PayKlik o de
 * LogiExpress no bloquea al cliente que está comprando (DC-01, DC-06).
 */
@Component
public class OutboxDispatcher {

    private static final Logger log = LoggerFactory.getLogger(OutboxDispatcher.class);

    private final OutboxRepository outbox;
    private final Map<String, OutboxHandler> handlers = new HashMap<>();

    @Value("${sgologic.outbox.batch-size:25}")
    private int batchSize;

    @Value("${sgologic.outbox.max-attempts:5}")
    private int maxAttempts;

    @Value("${sgologic.outbox.base-backoff-seconds:2}")
    private long baseBackoffSeconds;

    public OutboxDispatcher(OutboxRepository outbox, List<OutboxHandler> handlers) {
        this.outbox = outbox;
        for (OutboxHandler handler : handlers) {
            OutboxHandler previous = this.handlers.put(handler.eventType(), handler);
            if (previous != null) {
                throw new IllegalStateException("dos manejadores para el evento " + handler.eventType());
            }
        }
    }

    @Scheduled(fixedDelayString = "${sgologic.outbox.poll-fixed-delay-ms:2000}")
    public void dispatchPending() {
        List<OutboxEvent> batch = outbox.lease(batchSize);
        for (OutboxEvent event : batch) {
            dispatch(event);
        }
    }

    private void dispatch(OutboxEvent event) {
        OutboxHandler handler = handlers.get(event.eventType());
        int attempts = event.attempts() + 1;

        if (handler == null) {
            log.error("evento {} de tipo {} sin manejador registrado", event.id(), event.eventType());
            outbox.markFailed(event.id(), attempts, "no hay manejador para el evento " + event.eventType());
            return;
        }

        try {
            handler.handle(event);
            outbox.markDelivered(event.id(), attempts);
        } catch (RuntimeException e) {
            String error = e.getClass().getSimpleName() + ": " + e.getMessage();
            if (attempts >= maxAttempts) {
                log.warn("evento {} ({}) agotó {} intentos: {}", event.id(), event.eventType(), attempts, error);
                outbox.markFailed(event.id(), attempts, error);
                safelyExhaust(handler, event, error);
            } else {
                long backoff = baseBackoffSeconds * (1L << (attempts - 1));
                log.info("evento {} ({}) falló en el intento {}, se reintenta en {}s: {}",
                        event.id(), event.eventType(), attempts, backoff, error);
                outbox.markForRetry(event.id(), attempts, backoff, error);
            }
        }
    }

    /** La degradación no puede tumbar al repartidor: si también falla, se registra y se sigue. */
    private void safelyExhaust(OutboxHandler handler, OutboxEvent event, String error) {
        try {
            handler.onRetriesExhausted(event, error);
        } catch (RuntimeException e) {
            log.error("falló la degradación del evento {} ({})", event.id(), event.eventType(), e);
        }
    }
}
