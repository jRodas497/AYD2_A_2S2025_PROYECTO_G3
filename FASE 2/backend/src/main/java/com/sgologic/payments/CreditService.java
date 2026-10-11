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
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.integration.erp.ErpCustomerHistoryService histories;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.notifications.NotificationService notifications;
    @org.springframework.beans.factory.annotation.Autowired
    private RefundService refunds;
    @org.springframework.beans.factory.annotation.Autowired
    private com.fasterxml.jackson.databind.ObjectMapper json;
    public CreditService(JdbcTemplate jdbc, PayKlikClient payklik, TransactionTemplate tx, AuditService audit) {
        this.jdbc=jdbc; this.payklik=payklik; this.tx=tx; this.audit=audit;
    }
    private int integerSetting(String key) {
        return Integer.parseInt(jdbc.queryForObject("select value from config.setting where key=?", String.class, key));
    }
    public Map<String,Object> account(Long customerId) {
        histories.refresh(customerId,false);
        return assess(customerId);
    }
    public void refreshHistory(Long customerId){histories.refresh(customerId,false);}
    private Map<String,Object> assess(Long customerId) {
        var customers=jdbc.queryForList("select id from customers.customer where id=?", customerId);
        if(customers.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"cliente no encontrado");
        int delivered=jdbc.queryForObject("select count(*) from orders.purchase_order where customer_id=? and status_id=7", Integer.class, customerId);
        int problems=jdbc.queryForObject("select count(*) from orders.incident i join orders.purchase_order o on o.id=i.order_id where o.customer_id=? and i.status_id=3 and i.type_id=1", Integer.class, customerId);
        int returns=jdbc.queryForObject("select count(*) from orders.incident i join orders.purchase_order o on o.id=i.order_id where o.customer_id=? and i.status_id=3 and i.type_id=2",Integer.class,customerId);
        int pending=jdbc.queryForObject("select count(*) from orders.incident i join orders.purchase_order o on o.id=i.order_id where o.customer_id=? and i.status_id in (1,2)",Integer.class,customerId);
        int overdue=jdbc.queryForObject("select count(*) from payments.credit_charge where customer_id=? and voided_at is null and ((paid_at is null and due_at<now()) or paid_at>due_at)", Integer.class, customerId);
        int declined=jdbc.queryForObject("select count(*) from payments.payment_attempt p join orders.purchase_order o on o.id=p.order_id where o.customer_id=? and p.result_id=2", Integer.class, customerId);
        BigDecimal limit=new BigDecimal(jdbc.queryForObject("select value from config.setting where key='credit.limit'", String.class));
        BigDecimal used=jdbc.queryForObject("select coalesce(sum(amount),0) from payments.credit_charge where customer_id=? and paid_at is null and voided_at is null", BigDecimal.class, customerId);
        int outstanding=jdbc.queryForObject("select count(*) from payments.credit_charge where customer_id=? and voided_at is null and paid_at is null and due_at<now()",Integer.class,customerId);
        BigDecimal amount=jdbc.queryForObject("select coalesce(sum(total),0) from orders.purchase_order where customer_id=? and status_id=7",BigDecimal.class,customerId);
        var history=histories.history(customerId);
        boolean available=histories.current(customerId);
        delivered+=history.deliveredOrders();amount=amount.add(history.purchasedAmount());
        problems+=history.confirmedIncidents();returns+=history.returns();declined+=history.declinedPayments();
        int late=overdue-outstanding+history.latePayments();outstanding+=history.overduePayments();
        BigDecimal minimum=new BigDecimal(jdbc.queryForObject("select value from config.setting where key='credit.minimum_purchase_amount'",String.class));
        String reason=!available?"No hay un historial ERP vigente. Puedes pagar con PayKlik."
            :outstanding>0?"Existe un saldo vencido"
            :pending>0?"Hay una solicitud de cambio o devolución en revisión"
            :late>integerSetting("credit.maximum_late_payments")?"El historial registra pagos fuera de plazo"
            :problems>integerSetting("credit.maximum_confirmed_incidents")?"El historial registra incidencias confirmadas"
            :returns>integerSetting("credit.maximum_returns")?"El historial registra devoluciones confirmadas"
            :declined>integerSetting("credit.maximum_declined_payments")?"El historial registra pagos rechazados"
            :delivered<integerSetting("credit.minimum_delivered_orders")?"Se requieren más compras entregadas"
            :amount.compareTo(minimum)<0?"No se alcanza el importe mínimo de compras entregadas":null;
        var result=new java.util.LinkedHashMap<String,Object>();
        result.put("eligible",reason==null);result.put("reason",reason==null?"Historial confiable y pagos al día":reason);
        result.put("limit",limit);result.put("used",used);result.put("available",limit.subtract(used).max(BigDecimal.ZERO));
        result.put("termDays",integerSetting("credit.term_days"));result.put("deliveredOrders",delivered);
        result.put("purchasedAmount",amount);result.put("confirmedIncidents",problems);result.put("returns",returns);
        result.put("pendingIncidents",pending);result.put("latePayments",late);result.put("overduePayments",outstanding);
        result.put("declinedPayments",declined);result.put("erpAvailable",available);result.put("erpHistory",history);
        result.put("criteria",Map.of("minimumDeliveredOrders",integerSetting("credit.minimum_delivered_orders"),"minimumPurchaseAmount",minimum,
            "maximumConfirmedIncidents",integerSetting("credit.maximum_confirmed_incidents"),"maximumReturns",integerSetting("credit.maximum_returns"),
            "maximumLatePayments",integerSetting("credit.maximum_late_payments"),"maximumDeclinedPayments",integerSetting("credit.maximum_declined_payments")));
        return result;
    }
    /** Persist the decision in the transaction that returns its result, including denials. */
    public String authorize(PurchaseOrder order) {
        lockCustomer(order.getCustomerId());
        var assessment=assess(order.getCustomerId());
        String rejection=!Boolean.TRUE.equals(assessment.get("eligible"))?String.valueOf(assessment.get("reason")):
            order.getTotal().compareTo((BigDecimal)assessment.get("available"))>0?"crédito disponible insuficiente":null;
        String outcome=rejection==null?"APPROVED":"DECLINED";
        Long id;
        try{id=jdbc.queryForObject("insert into payments.credit_application(customer_id,order_id,amount,status,reason,assessment) values(?,?,?,?,?,?::jsonb) returning id",Long.class,
            order.getCustomerId(),order.getId(),order.getTotal(),outcome,rejection==null?"Crédito aprobado":rejection,json.writeValueAsString(assessment));}
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
        audit.record(AuditService.currentActor(),"CREDITO_SOLICITUD_"+outcome,"credit_application",id,order.getId(),order.getChannel(),Map.of("motivo",rejection==null?"Crédito aprobado":rejection,"monto",order.getTotal()));
        notifications.queueForOrder(order.getId(),rejection==null?"Crédito aprobado para la orden "+order.getId()+". Paga en "+integerSetting("credit.term_days")+" días.":"Tu solicitud de crédito para la orden "+order.getId()+" fue rechazada: "+rejection+". Puedes continuar con PayKlik.");
        return rejection;
    }
    public List<Map<String,Object>> applications(Long id){
        var rows=jdbc.queryForList("select id,order_id,amount,status,reason,assessment::text,created_at from payments.credit_application where customer_id=? order by id desc limit 100",id);
        for(var row:rows)try{row.put("assessment",json.readValue(String.valueOf(row.get("assessment")),Map.class));}
        catch(com.fasterxml.jackson.core.JsonProcessingException e){throw new IllegalStateException(e);}
        return rows;
    }
    /** Called inside the order settlement transaction. Customer row serializes credit spending. */
    public String purchase(PurchaseOrder order) {
        lockCustomer(order.getCustomerId());
        var account=assess(order.getCustomerId());
        if(!Boolean.TRUE.equals(account.get("eligible"))) throw new ResponseStatusException(HttpStatus.CONFLICT, String.valueOf(account.get("reason")));
        if(order.getTotal().compareTo((BigDecimal)account.get("available"))>0) throw new ResponseStatusException(HttpStatus.CONFLICT,"crédito disponible insuficiente");
        Long id=jdbc.queryForObject("insert into payments.credit_charge(customer_id,order_id,amount,due_at) values(?,?,?,now()+make_interval(days=>?)) returning id", Long.class,
                order.getCustomerId(),order.getId(),order.getTotal(),integerSetting("credit.term_days"));
        audit.recordSystem("CREDITO_COMPRA", "credit_charge",id,order.getId(),order.getChannel(),Map.of("monto",order.getTotal()));
        return "CREDIT-"+id;
    }
    public List<Map<String,Object>> charges(Long customerId) {
        return jdbc.queryForList("select id,order_id,amount,due_at,paid_at,voided_at,repayment_reference,repayment_error,return_pending,created_at, (paid_at is null and voided_at is null and due_at<now()) as overdue from payments.credit_charge where customer_id=? order by id desc",customerId);
    }
    @org.springframework.transaction.annotation.Transactional
    public Map<String,Object> retryRepayment(Long customerId,Long id) {
        lockCustomer(customerId);var charge=loadCharge(customerId,id);
        if(charge.get("paid_at")!=null) return Map.of("paid",true);
        if(charge.get("voided_at")!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"saldo anulado");
        if(Boolean.TRUE.equals(charge.get("return_pending"))&&!"PENDING".equals(charge.get("repayment_reference")))throw new ResponseStatusException(HttpStatus.CONFLICT,"devolución en proceso; no se admite un nuevo abono");
        int changed=jdbc.update("update integration.outbox set status_id=1,kafka_published_at=null,relay_lease_until=null,attempts=0,last_error=null where event_type='CreditRepaymentRequested' and aggregate_id=? and status_id=3",id);
        if(changed==0) throw new ResponseStatusException(HttpStatus.CONFLICT,"no hay un abono fallido para reintentar");
        jdbc.update("update payments.credit_charge set repayment_reference='PENDING',repayment_error=null where id=?",id);
        return Map.of("paid",false,"queued",true);
    }
    public Map<String,Object> repay(Long customerId, Long id, String token) {
        tx.executeWithoutResult(status -> {
            lockCustomer(customerId);
            var charge=loadCharge(customerId,id);
            if(charge.get("voided_at")!=null) throw new ResponseStatusException(HttpStatus.CONFLICT,"compra devuelta; saldo anulado");
            if(charge.get("paid_at")!=null) return;
            if(Boolean.TRUE.equals(charge.get("return_pending"))&&!"PENDING".equals(charge.get("repayment_reference")))throw new ResponseStatusException(HttpStatus.CONFLICT,"devolución en proceso; no se admite un nuevo abono");
            if(!"PENDING".equals(charge.get("repayment_reference"))) {
                jdbc.update("update payments.credit_charge set repayment_reference='PENDING',repayment_token=?,repayment_error=null where id=?",token,id);
                outbox.publish("credit_charge",id,"CreditRepaymentRequested",Map.of("customerId",customerId,"chargeId",id));
            }
        });
        try { return collectRepayment(customerId,id); }
        catch(com.sgologic.external.ProviderUnavailableException e) {
            return Map.of("paid",false,"queued",true,"message","El abono está en proceso y se reintentará automáticamente");
        }
    }
    public Map<String,Object> collectRepayment(Long customerId, Long id) {
        var charge=tx.execute(status->{
            lockCustomer(customerId);
            var current=loadCharge(customerId,id);
            if(current.get("paid_at")==null&&"PENDING".equals(current.get("repayment_reference"))) {
                int leased=jdbc.update("update payments.credit_charge set repayment_lease_until=now()+interval '15 seconds' where id=? and (repayment_lease_until is null or repayment_lease_until<now())",id);
                if(leased==0)throw new com.sgologic.external.ProviderUnavailableException(com.sgologic.external.Provider.PAYKLIK,0,false,"otro proceso está confirmando el mismo abono");
            }
            return current;
        });
        if(charge.get("paid_at")!=null) return Map.of("paid",true,"message","pago ya registrado");
        if(!"PENDING".equals(charge.get("repayment_reference"))) {
            if(charge.get("voided_at")!=null) return Map.of("paid",false,"voided",true);
            if(charge.get("repayment_error")!=null)return Map.of("paid",false,"declined",true);
            throw new IllegalStateException("el abono no tiene una intención activa; se requiere un nuevo intento");
        }
        PayKlikClient.ChargeResponse response;
        try{response=payklik.charge(-id,(BigDecimal)charge.get("amount"),String.valueOf(charge.get("repayment_token")),5000);}
        catch(RuntimeException e){jdbc.update("update payments.credit_charge set repayment_lease_until=null where id=? and repayment_token=?",id,charge.get("repayment_token"));throw e;}
        if(!response.approved()) {
            tx.executeWithoutResult(status->{lockCustomer(customerId);
                int changed=jdbc.update("update payments.credit_charge set repayment_reference=null,repayment_error=?,repayment_lease_until=null where id=? and paid_at is null and repayment_reference='PENDING' and repayment_token=?",response.failureReason(),id,charge.get("repayment_token"));
                if(changed==1)notifications.queueForOrder(((Number)charge.get("order_id")).longValue(),"El abono fue rechazado: "+response.failureReason());
                refunds.resumeAfterRepayment(((Number)charge.get("order_id")).longValue());
            });
            throw new ResponseStatusException(HttpStatus.CONFLICT,response.failureReason());
        }
        tx.executeWithoutResult(status -> {
            lockCustomer(customerId);
            int changed=jdbc.update("update payments.credit_charge set paid_at=now(),repayment_reference=?,repayment_error=null,repayment_lease_until=null where id=? and customer_id=? and paid_at is null and voided_at is null",response.providerReference(),id,customerId);
            if(changed==1) audit.recordSystem("CREDITO_ABONO","credit_charge",id,null,null,Map.of("referencia",response.providerReference(),"monto",charge.get("amount")));
            if(changed==0&&loadCharge(customerId,id).get("paid_at")==null)throw new IllegalStateException("el abono cobrado requiere conciliación");
            if(changed==1)notifications.queueForOrder(((Number)charge.get("order_id")).longValue(),"Abono registrado. El saldo de la orden "+charge.get("order_id")+" está pagado.");
            refunds.resumeAfterRepayment(((Number)charge.get("order_id")).longValue());
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
