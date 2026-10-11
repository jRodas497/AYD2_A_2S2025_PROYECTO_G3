package com.sgologic.logistics;

import com.sgologic.integration.OutboxEvent;
import com.sgologic.integration.OutboxHandler;
import org.springframework.stereotype.Component;

@Component
public class ShipmentGuideHandler implements OutboxHandler {
    private final DispatchService dispatch;
    public ShipmentGuideHandler(DispatchService dispatch) { this.dispatch=dispatch; }
    @Override public String eventType() { return "ShipmentGuideRequested"; }
    @Override public void handle(OutboxEvent event) { dispatch.requestGuide(event.longValue("shipmentId")); }
    @Override public void onRetriesExhausted(OutboxEvent event,String error) { dispatch.alertLogistics(event.longValue("orderId"),error); }
}
