package com.sgologic.payments;

import com.sgologic.audit.AuditService;
import com.sgologic.config.SettingsService;
import com.sgologic.external.PayKlikClient;
import com.sgologic.orders.PurchaseOrder;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Credit is earned from delivered, incident-free orders and timely repayments. */
@Service
public class CreditService {
    private final JdbcTemplate jdbc;
    private final PayKlikClient payklik;
    private final TransactionTemplate tx;
    private final AuditService audit;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.integration.OutboxService outbox;
    public CreditService(JdbcTemplate jdbc, PayKlikClient payklik, TransactionTemplate tx, AuditService audit) {
        this.jdbc=jdbc; this.payklik=payklik; this.tx=tx; this.audit=audit;
    }
    private int integerSetting(String key) {
        return Integer.parseInt(jdbc.queryForObject("select value from config.setting where key=?", String.class, key));
    }
    public Map<String,Object> account(Long customerId) {
        var customers=jdbc.queryForList("select id from customers.customer where id=?", customerId);
        if(customers.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"cliente no encontrado");
        int delivered=jdbc.queryForObject("select count(*) from orders.purchase_order where customer_id=? and status_id=7", Integer.class, customerId);
        int problems=jdbc.queryForObject("select count(*) from orders.incident i join orders.purchase_order o on o.id=i.order_id where o.customer_id=?", Integer.class, customerId);
        int overdue=jdbc.queryForObject("select count(*) from payments.credit_charge where customer_id=? and voided_at is null and ((paid_at is null and due_at<now()) or paid_at>due_at)", Integer.class, customerId);
        int declined=jdbc.queryForObject("select count(*) from payments.payment_attempt p join orders.purchase_order o on o.id=p.order_id where o.customer_id=? and p.result_id=2", Integer.class, customerId);
        BigDecimal limit=new BigDecimal(jdbc.queryForObject("select value from config.setting where key='credit.limit'", String.class));
        BigDecimal used=jdbc.queryForObject("select coalesce(sum(amount),0) from payments.credit_charge where customer_id=? and paid_at is null and voided_at is null", BigDecimal.class, customerId);
        boolean eligible=delivered>=integerSetting("credit.minimum_delivered_orders") && problems==0 && overdue==0 && declined==0;
        String reason=eligible ? "Historial confiable y pagos al día" : overdue>0 ? "Existe un pago vencido o fuera de plazo" : problems>0 || declined>0 ? "El historial registra incidencias o pagos rechazados" : "Se requieren más compras entregadas";
        return Map.of("eligible",eligible,"limit",limit,"used",used,"available",limit.subtract(used).max(BigDecimal.ZERO),
                "reason",reason,"termDays",integerSetting("credit.term_days"),"deliveredOrders",delivered);
    }
    /** Called inside the order settlement transaction. Customer row serializes credit spending. */
    public String purchase(PurchaseOrder order) {
        lockCustomer(order.getCustomerId());
        var account=account(order.getCustomerId());
        if(!Boolean.TRUE.equals(account.get("eligible"))) throw new ResponseStatusException(HttpStatus.CONFLICT, String.valueOf(account.get("reason")));
        if(order.getTotal().compareTo((BigDecimal)account.get("available"))>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"crédito disponible insuficiente");
        Long id=jdbc.queryForObject("insert into payments.credit_charge(customer_id,order_id,amount,due_at) values(?,?,?,now()+make_interval(days=>?)) returning id", Long.class,
                order.getCustomerId(),order.getId(),order.getTotal(),integerSetting("credit.term_days"));
        audit.recordSystem("CREDITO_COMPRA", "credit_charge",id,order.getId(),order.getChannel(),Map.of("monto",order.getTotal()));
        return "CREDIT-"+id;
    }
    public List<Map<String,Object>> charges(Long customerId) {
        return jdbc.queryForList("select id,order_id,amount,due_at,paid_at,voided_at,repayment_reference,created_at, (paid_at is null and voided_at is null and due_at<now()) as overdue from payments.credit_charge where customer_id=? order by id desc",customerId);
    }
    public Map<String,Object> repay(Long customerId, Long id, String token) {
        tx.executeWithoutResult(status -> {
            lockCustomer(customerId);
            var charge=loadCharge(customerId,id);
            if(charge.get("voided_at")!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"compra devuelta; saldo anulado");
            if(charge.get("paid_at")!=null) return;
            if(!"PENDING".equals(charge.get("repayment_reference"))) {
                jdbc.update("update payments.credit_charge set repayment_reference='PENDING',repayment_token=? where id=?",token,id);
                outbox.publish("credit_charge",id,"CreditRepaymentRequested",Map.of("customerId",customerId,"chargeId",id));
            }
        });
        try { return collectRepayment(customerId,id); }
        catch(com.sgologic.external.ProviderUnavailableException e) {
            return Map.of("paid",false,"queued",true,"message","El abono está en proceso y se reintentará automáticamente");
        }
    }
    public Map<String,Object> collectRepayment(Long customerId, Long id) {
        var charge=loadCharge(customerId,id);
        if(charge.get("paid_at")!=null) return Map.of("paid",true,"message","pago ya registrado");
        if(!"PENDING".equals(charge.get("repayment_reference"))) return Map.of("paid",false);
        var response=payklik.charge(-id,(BigDecimal)charge.get("amount"),String.valueOf(charge.get("repayment_token")),5000);
        if(!response.approved()) {
            jdbc.update("update payments.credit_charge set repayment_reference=null where id=? and paid_at is null",id);
            throw new ResponseStatusException(HttpStatus.CONFLICT,response.failureReason());
        }
        tx.executeWithoutResult(status -> {
            lockCustomer(customerId);
            int changed=jdbc.update("update payments.credit_charge set paid_at=now(),repayment_reference=? where id=? and customer_id=? and paid_at is null and voided_at is null",response.providerReference(),id,customerId);
            if(changed==1) audit.recordSystem("CREDITO_ABONO","credit_charge",id,null,null,Map.of("referencia",response.providerReference(),"monto",charge.get("amount")));
        });
        return Map.of("paid",true,"reference",response.providerReference());
    }
    private Map<String,Object> loadCharge(Long customerId,Long id) {
        var rows=jdbc.queryForList("select * from payments.credit_charge where id=? and customer_id=?",id,customerId);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"cuenta de crédito no encontrada");
        return rows.get(0);
    }
    private void lockCustomer(Long id) { jdbc.queryForObject("select id from customers.customer where id=? for update",Long.class,id); }
}
