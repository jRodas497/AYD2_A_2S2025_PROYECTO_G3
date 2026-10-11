package com.sgologic.payments;
import com.sgologic.integration.*;
import org.springframework.stereotype.Component;
@Component
public class CreditRepaymentHandler implements OutboxHandler {
    private final CreditService credit;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;
    public CreditRepaymentHandler(CreditService credit,org.springframework.jdbc.core.JdbcTemplate jdbc) { this.credit=credit;this.jdbc=jdbc; }
    @Override public String eventType() { return "CreditRepaymentRequested"; }
    @Override public void handle(OutboxEvent event) { credit.collectRepayment(event.longValue("customerId"),event.longValue("chargeId")); }
    @Override public void onRetriesExhausted(OutboxEvent event,String error) {
        jdbc.update("update payments.credit_charge set repayment_reference=null where id=? and paid_at is null",event.longValue("chargeId"));
    }
}
