package com.sgologic.integration;

/**
 * Quien procesa un tipo de evento del outbox. Cada tipo tiene exactamente un manejador: el
 * módulo dueño del paso siguiente del flujo lo implementa (pagos reintenta el cobro,
 * facturación emite la factura, logística despacha).
 *
 * <p>Un manejador debe ser idempotente: la entrega es "al menos una vez", así que el mismo
 * evento puede llegar dos veces si el proceso se cae entre el envío y la confirmación.
 */
public interface OutboxHandler {

    /** El tipo de evento que atiende, de {@link EventTypes}. */
    String eventType();

    /** Procesa el evento. Si lanza, el repartidor lo reintenta con espera creciente. */
    void handle(OutboxEvent event);

    /**
     * Se llama cuando el evento agotó todos sus reintentos. Es el punto donde cada módulo
     * decide su degradación: dejar la orden en pago fallido, levantar una alerta operativa,
     * avisarle al cliente. Por defecto no hace nada.
     */
    default void onRetriesExhausted(OutboxEvent event, String lastError) {
    }
}
