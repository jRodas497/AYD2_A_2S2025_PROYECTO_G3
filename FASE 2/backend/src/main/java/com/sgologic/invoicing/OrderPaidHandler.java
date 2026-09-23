package com.sgologic.invoicing;

import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxEvent;
import com.sgologic.integration.OutboxHandler;
import org.springframework.stereotype.Component;

/**
 * El cobro se aprobó, así que toca facturar (CDU-02 -> CDU-03). Si la SAT rechaza o no
 * responde, esto lanza y el evento se reintenta; al agotarse queda escalado para revisión
 * manual con la orden retenida antes de despacho.
 */
@Component
public class OrderPaidHandler implements OutboxHandler {

    private final InvoicingService invoicing;

    public OrderPaidHandler(InvoicingService invoicing) {
        this.invoicing = invoicing;
    }

    @Override
    public String eventType() {
        return EventTypes.ORDER_PAID;
    }

    @Override
    public void handle(OutboxEvent event) {
        invoicing.issue(event.longValue("orderId"));
    }

    @Override
    public void onRetriesExhausted(OutboxEvent event, String lastError) {
        invoicing.escalate(event.longValue("orderId"), lastError);
    }
}
