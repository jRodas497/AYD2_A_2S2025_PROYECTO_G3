package com.sgologic.payments;

import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxEvent;
import com.sgologic.integration.OutboxHandler;
import org.springframework.stereotype.Component;

/**
 * Reintenta un cobro que quedó en la cola de contingencia porque PayKlik no respondió
 * (ADR-0002). Es idempotente: si la orden ya se cobró, el evento se da por atendido.
 */
@Component
public class PaymentRetryHandler implements OutboxHandler {

    private final PaymentService payments;

    public PaymentRetryHandler(PaymentService payments) {
        this.payments = payments;
    }

    @Override
    public String eventType() {
        return EventTypes.PAYMENT_RETRY_REQUESTED;
    }

    @Override
    public void handle(OutboxEvent event) {
        payments.retry(
                event.longValue("orderId"),
                PaymentMethod.valueOf(event.stringValue("metodo")),
                event.stringValue("cardToken"),
                event.stringValue("cardLast4"));
    }

    @Override
    public void onRetriesExhausted(OutboxEvent event, String lastError) {
        payments.giveUp(event.longValue("orderId"), lastError);
    }
}
