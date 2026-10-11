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
        Long id=jdbc.queryForObject("insert into payments.refund(order_id,amount) values(?,?) returning id",Long.class,order.getId(),order.getTotal());
        boolean shipped=jdbc.queryForObject("select exists(select 1 from logistics.shipment where order_id=?)",Boolean.class,order.getId());
        var lines=jdbc.queryForList("select id,location_id,product_id,quantity from inventory.reservation where order_id=? and status_id=2 order by id for update",order.getId());
        for(var line:lines) {
            int qty=((Number)line.get("quantity")).intValue();
            Long location=((Number)line.get("location_id")).longValue();
            Long product=((Number)line.get("product_id")).longValue();
            if(shipped) {
                jdbc.update("update inventory.stock set on_hand=on_hand+?,updated_at=now() where location_id=? and product_id=?",qty,location,product);
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
        var refund=jdbc.queryForMap("select * from payments.refund where id=?",id);
        if(((Number)refund.get("status_id")).intValue()==2) return;
        Long order=((Number)refund.get("order_id")).longValue();
        var credit=jdbc.queryForList("select paid_at,repayment_reference from payments.credit_charge where order_id=?",order);
        if(!credit.isEmpty() && "PENDING".equals(credit.get(0).get("repayment_reference")))
            throw new IllegalStateException("abono en proceso; se espera el resultado antes del reembolso");
        String reference="CREDIT-VOID-"+id;
        if(credit.isEmpty() || credit.get(0).get("paid_at")!=null) {
            var response=providers.execute(Provider.PAYKLIK,"refund-"+id,Map.of("operation","REFUND","orderId",order,"amount",refund.get("amount")),5000,PayKlikClient.ChargeResponse.class);
            if(!response.approved()) throw new IllegalStateException(response.failureReason());
            reference=response.providerReference();
        }
        final String providerRef=reference;
        tx.executeWithoutResult(status -> {
            jdbc.queryForObject("select id from payments.refund where id=? for update",Long.class,id);
            int updated=jdbc.update("update payments.refund set status_id=2,provider_reference=?,refunded_at=now() where id=? and status_id<>2",providerRef,id);
            if(updated==0) return;
            jdbc.update("update payments.credit_charge set voided_at=now() where order_id=?",order);
            audit.recordSystem("REEMBOLSO_APROBADO","refund",id,order,null,Map.of("monto",refund.get("amount"),"referencia",providerRef));
        });
    }
    @Override public void onRetriesExhausted(OutboxEvent event,String error) {
        jdbc.update("update payments.refund set status_id=3 where id=? and status_id<>2",event.longValue("refundId"));
    }
}
