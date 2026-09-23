package com.sgologic.integration;

import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Publicación de eventos (Transactional Outbox, ADR-0002).
 *
 * <p>La clave del patrón está en que esto se llama <em>dentro</em> de la transacción que cambia
 * el estado del negocio: el evento y el hecho se guardan juntos o no se guarda ninguno. Por eso
 * una caída justo después de cobrar no puede dejar una orden pagada sin facturar, ni un evento
 * de una orden que al final no existió.
 */
@Service
public class OutboxService {

    private final OutboxRepository outbox;

    public OutboxService(OutboxRepository outbox) {
        this.outbox = outbox;
    }

    public Long publish(String aggregateType, Long aggregateId, String eventType, Map<String, Object> payload) {
        return outbox.publish(aggregateType, aggregateId, eventType, payload);
    }

    /** Evento sobre una orden, que es el caso normal. */
    public Long publishForOrder(Long orderId, String eventType, Map<String, Object> payload) {
        return publish("order", orderId, eventType, payload);
    }
}
