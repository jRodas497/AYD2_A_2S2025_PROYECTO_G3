package com.sgologic.integration;

/**
 * Nombres de los mensajes que viajan por el outbox. Son texto en la base a propósito (crecen
 * con el código, no son un conjunto fijo), pero en el código viven aquí para que un typo no
 * deje un evento sin manejador.
 */
public final class EventTypes {

    /** El cobro fue aprobado: dispara la facturación (CDU-02 -> CDU-03). */
    public static final String ORDER_PAID = "OrderPaid";

    /** PayKlik no respondió: el cobro se reintenta sin perder la orden (ADR-0002). */
    public static final String PAYMENT_RETRY_REQUESTED = "PaymentRetryRequested";

    /** La SAT aceptó la factura: la orden ya puede despacharse (CDU-03 -> CDU-04). */
    public static final String ORDER_INVOICED = "OrderInvoiced";

    // No hay un evento aparte para reintentar la factura ni la guía: emitir la factura y
    // despachar son operaciones idempotentes, así que el reintento viaja en el mismo evento
    // (OrderPaid y OrderInvoiced) y la cola no se llena de tipos que significan lo mismo.

    private EventTypes() {
    }
}
