package com.sgologic.payments;
import com.sgologic.integration.*;
import com.sgologic.external.*;
import com.sgologic.audit.AuditService;
import com.sgologic.integration.pos.PosEventService;
import com.sgologic.orders.PurchaseOrder;
import java.math.BigDecimal;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/** Full-order returns: inventory restoration, idempotent refund and ERP accounting adjustment. */
@Service
public class RefundService implements OutboxHandler {
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.inventory.StockTransferService transfers;
    private final JdbcTemplate jdbc;
    private final OutboxService outbox;
    private final ProviderHttp providers;
    private final TransactionTemplate tx;
    private final AuditService audit;
    private final PosEventService pos;
    public RefundService(JdbcTemplate jdbc,OutboxService outbox,ProviderHttp providers,TransactionTemplate tx,AuditService audit,PosEventService pos) {
        this.jdbc=jdbc;this.outbox=outbox;this.providers=providers;this.tx=tx;this.audit=audit;this.pos=pos;
    }
    public void queue(PurchaseOrder order) {
        lockCustomer(order.getCustomerId());
        jdbc.update("update payments.credit_charge set return_pending=true where order_id=?",order.getId());
        Long id=jdbc.queryForObject("insert into payments.refund(order_id,amount) values(?,?) returning id",Long.class,order.getId(),order.getTotal());
        boolean shipped=jdbc.queryForObject("select exists(select 1 from logistics.shipment where order_id=?)",Boolean.class,order.getId());
        transfers.cancelPendingOrder(order.getId());
        var lines=jdbc.queryForList("select r.id,r.location_id,r.product_id,r.quantity,t.status as transfer_status from inventory.reservation r left join inventory.stock_transfer t on t.id=r.transfer_id where r.order_id=? and r.status_id=2 order by r.id for update of r",order.getId());
        for(var line:lines) {
            if("IN_TRANSIT".equals(line.get("transfer_status"))){
                jdbc.update("update inventory.reservation set status_id=3,closed_at=now() where id=?",line.get("id"));
                continue; // Receipt later restores these units at the actual destination.
            }
            int qty=((Number)line.get("quantity")).intValue();
            Long location=((Number)line.get("location_id")).longValue();
            Long product=((Number)line.get("product_id")).longValue();
            if(shipped) {
                var active=jdbc.queryForList("select id from inventory.location where id=? and active for share",Long.class,location);
                if(active.isEmpty()) {
                    var receiving=jdbc.queryForList("select id from inventory.location where active order by case type_id when 1 then 0 when 3 then 1 else 2 end,id limit 1 for share",Long.class);
                    if(receiving.isEmpty())throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.CONFLICT,"no hay ubicación activa para recibir la devolución");
                    Long previous=location;location=receiving.get(0);
                    jdbc.update("update inventory.reservation set location_id=? where id=?",location,line.get("id"));
                    audit.recordSystem("DEVOLUCION_UBICACION_REASIGNADA","order",order.getId(),order.getId(),null,Map.of("origenCerrado",previous,"recepcion",location,"producto",product));
                }
                jdbc.update("insert into inventory.stock(location_id,product_id,on_hand) values(?,?,?) on conflict(location_id,product_id) do update set on_hand=stock.on_hand+excluded.on_hand,updated_at=now()",location,product,qty);
                jdbc.update("insert into inventory.stock_movement(location_id,product_id,type_id,quantity,reason,order_id) values(?,?,1,?,'Devolución recibida',?)",location,product,qty,order.getId());
            } else jdbc.update("update inventory.stock set reserved=reserved-?,updated_at=now() where location_id=? and product_id=?",qty,location,product);
            jdbc.update("update inventory.reservation set status_id=3,closed_at=now() where id=?",line.get("id"));
            Short type=jdbc.queryForObject("select type_id from inventory.location where id=?",Short.class,location);
            if(type==2) pos.publish(location,PosEventService.STOCK_ADJUSTED,Map.of("orderId",order.getId(),"productId",product,"quantity",qty,"motivo","devolución"));
        }
        outbox.publishForOrder(order.getId(),eventType(),Map.of("refundId",id));
    }
    @Override public String eventType() { return "RefundRequested"; }
    @Override public void handle(OutboxEvent event) {
        Long id=event.longValue("refundId");
        var refund=tx.execute(status -> {
            Long customer=jdbc.queryForObject("select o.customer_id from payments.refund r join orders.purchase_order o on o.id=r.order_id where r.id=?",Long.class,id);
            lockCustomer(customer);
            var current=jdbc.queryForMap("select * from payments.refund where id=? for update",id);
            if(((Number)current.get("status_id")).intValue()==2)return null;
            Long order=((Number)current.get("order_id")).longValue();
            var credit=jdbc.queryForList("select paid_at,repayment_reference from payments.credit_charge where order_id=? for update",order);
            jdbc.update("update payments.credit_charge set return_pending=true where order_id=?",order);
            if(!credit.isEmpty()&&"PENDING".equals(credit.get(0).get("repayment_reference"))) {
                // The repayment result publishes a new refund event; no retry budget is spent waiting.
                jdbc.update("update payments.refund set waiting_for_repayment=true,status_id=1 where id=?",id);
                return null;
            }
            if(!credit.isEmpty()&&credit.get(0).get("paid_at")==null){complete(id,order,"CREDIT-VOID-"+id,current.get("amount"));return null;}
            current.put("customer_id",customer);return current;
        });
        if(refund==null)return;
        Long order=((Number)refund.get("order_id")).longValue();
        var response=providers.execute(Provider.PAYKLIK,"refund-"+id,Map.of("operation","REFUND","orderId",order,"amount",refund.get("amount")),5000,PayKlikClient.ChargeResponse.class);
        if(!response.approved())throw new IllegalStateException(response.failureReason());
        tx.executeWithoutResult(status -> {
            lockCustomer(((Number)refund.get("customer_id")).longValue());
            jdbc.queryForObject("select id from payments.refund where id=? for update",Long.class,id);
            complete(id,order,response.providerReference(),refund.get("amount"));
        });
    }
    private void lockCustomer(Long customer){jdbc.queryForObject("select id from customers.customer where id=? for update",Long.class,customer);}
    private void complete(Long id,Long order,String reference,Object amount) {
        int updated=jdbc.update("update payments.refund set status_id=2,provider_reference=?,refunded_at=now(),waiting_for_repayment=false where id=? and status_id<>2",reference,id);
        if(updated==0)return;
        jdbc.update("update payments.credit_charge set voided_at=now(),return_pending=true where order_id=?",order);
        audit.recordSystem("REEMBOLSO_APROBADO","refund",id,order,null,Map.of("monto",amount,"referencia",reference));
    }
    /** Caller holds the customer lock shared by refunds and repayment transitions. */
    public void resumeAfterRepayment(Long order) {
        var ids=jdbc.queryForList("update payments.refund set waiting_for_repayment=false,status_id=1 where order_id=? and status_id<>2 and (waiting_for_repayment or status_id=3) returning id",Long.class,order);
        for(Long id:ids)outbox.publishForOrder(order,eventType(),Map.of("refundId",id));
    }
    @Override public void onRetriesExhausted(OutboxEvent event,String error) {
        jdbc.update("update payments.refund set status_id=3 where id=? and status_id<>2",event.longValue("refundId"));
    }
}
