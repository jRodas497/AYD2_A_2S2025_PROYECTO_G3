package com.sgologic.external;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adaptador del proveedor de mensajería (SMS, correo, push). Es el único tercero que el
 * sistema trata como no crítico (ADR-0004): si falla, se registra y se reintenta en su propia
 * cola, pero jamás impide confirmar, pagar, facturar ni despachar una orden.
 */
@Component
public class MessagingClient {

    private static final Logger log = LoggerFactory.getLogger(MessagingClient.class);

    private final ExternalSimulation simulation;

    @Value("${sgologic.simulation.normal-latency-ms:80}")
    private long normalLatencyMs;

    public MessagingClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Entrega un aviso al proveedor.
     *
     * @return el motivo del rechazo, o {@code null} si se entregó
     * @throws ProviderUnavailableException si el proveedor no responde
     */
    public String send(String channel, String recipient, String message) {
        SimulationMode mode = simulation.modeOf(Provider.MESSAGING);

        switch (mode) {
            case DOWN, SLOW -> throw new ProviderUnavailableException(
                    Provider.MESSAGING, 0, mode == SimulationMode.SLOW,
                    "el proveedor de mensajería no respondió");
            case REJECT -> {
                return "el proveedor rechazó el destinatario " + recipient;
            }
            default -> {
                sleep(normalLatencyMs);
                log.debug("aviso {} entregado a {}: {}", channel, recipient, message);
                return null;
            }
        }
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
