package com.sgologic.inventory;
import com.sgologic.integration.*;
import org.springframework.stereotype.Component;
@Component
public class TransferDispatchHandler implements OutboxHandler {
    private final StockTransferService transfers;
    public TransferDispatchHandler(StockTransferService transfers){this.transfers=transfers;}
    public String eventType(){return "TransferDispatchRequested";}
    public void handle(OutboxEvent event){transfers.dispatch(event.longValue("transferId"));}
    public void onRetriesExhausted(OutboxEvent event,String error){transfers.exhausted(event.longValue("transferId"),error);}
}
