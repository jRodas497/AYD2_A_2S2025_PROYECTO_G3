package com.sgologic.logistics;

import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxEvent;
import com.sgologic.integration.OutboxHandler;
import org.springframework.stereotype.Component;

/**
 * La factura fue aceptada, así que la orden ya puede despacharse (CDU-03 -> CDU-04). Si
 * LogiExpress no emite la guía, esto lanza y el evento se reintenta; el envío ya existe, así
 * que el reintento solo vuelve a pedir la guía, no repite el despacho.
 */
@Component
public class OrderInvoicedHandler implements OutboxHandler {

    private final DispatchService dispatch;

    public OrderInvoicedHandler(DispatchService dispatch) {
        this.dispatch = dispatch;
    }

    @Override
    public String eventType() {
        return EventTypes.ORDER_INVOICED;
    }

    @Override
    public void handle(OutboxEvent event) {
        dispatch.dispatch(event.longValue("orderId"));
    }

    @Override
    public void onRetriesExhausted(OutboxEvent event, String lastError) {
        dispatch.alertLogistics(event.longValue("orderId"), lastError);
    }
}
