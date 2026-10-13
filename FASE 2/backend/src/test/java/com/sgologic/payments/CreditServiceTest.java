package com.sgologic.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.sgologic.audit.AuditService;
import com.sgologic.external.PayKlikClient;
import com.sgologic.integration.erp.ErpCustomerHistoryService;
import com.sgologic.integration.erp.ErpCustomerHistoryService.History;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

/** Fase 3: decisions in isolation, without network or database access. */
class CreditServiceTest {
    private CreditService service;
    private ErpCustomerHistoryService histories;
    private History history;
    private int pending;
    private BigDecimal used;

    @BeforeEach
    void setup() {
        history = new History(3, new BigDecimal("30.00"), 0, 0, 0, 0, 0);
        pending = 0;
        used = BigDecimal.ZERO;
        JdbcTemplate jdbc = mock(JdbcTemplate.class, call -> {
            String sql = call.getArgument(0);
            if (call.getMethod().getName().equals("queryForList")) return List.of(Map.of("id", 1L));
            if (!call.getMethod().getName().equals("queryForObject")) return null;
            Class<?> type = call.getArgument(1);
            if (type == Integer.class) return sql.contains("i.status_id in (1,2)") ? pending : 0;
            if (type == BigDecimal.class) return sql.contains("sum(amount)") ? used : BigDecimal.ZERO;
            if (sql.contains("credit.limit")) return "1000";
            if (sql.contains("credit.minimum_purchase_amount")) return "30";
            String key = call.getArgument(2);
            return Map.of("credit.minimum_delivered_orders", "3", "credit.term_days", "30",
                "credit.maximum_late_payments", "0", "credit.maximum_confirmed_incidents", "0",
                "credit.maximum_returns", "0", "credit.maximum_declined_payments", "0").get(key);
        });
        histories = mock(ErpCustomerHistoryService.class);
        when(histories.history(1L)).thenAnswer(call -> history);
        when(histories.current(1L)).thenReturn(true);
        service = new CreditService(jdbc, mock(PayKlikClient.class), mock(TransactionTemplate.class), mock(AuditService.class));
        ReflectionTestUtils.setField(service, "histories", histories);
    }

    @Test void U01_exact_minimum_deliveries_and_amount_are_eligible() {
        assertThat(service.account(1L)).containsEntry("eligible", true).containsEntry("termDays", 30);
    }

    @Test void U02_new_customer_has_no_credit() {
        history = History.empty();
        assertThat(service.account(1L)).containsEntry("eligible", false)
            .containsEntry("reason", "Se requieren más compras entregadas");
    }

    @Test void U03_amount_below_minimum_is_denied() {
        history = new History(3, new BigDecimal("29.99"), 0, 0, 0, 0, 0);
        assertThat(service.account(1L)).containsEntry("eligible", false)
            .containsEntry("reason", "No se alcanza el importe mínimo de compras entregadas");
    }

    @ParameterizedTest(name = "U04 ERP risk factor {0} rejects credit")
    @ValueSource(strings = {"late", "overdue", "returns", "incidents", "declined"})
    void U04_each_erp_risk_factor_rejects_credit(String factor) {
        history = new History(3, new BigDecimal("30"), factor.equals("late") ? 1 : 0,
            factor.equals("overdue") ? 1 : 0, factor.equals("returns") ? 1 : 0,
            factor.equals("incidents") ? 1 : 0, factor.equals("declined") ? 1 : 0);
        assertThat(service.account(1L)).containsEntry("eligible", false);
    }

    @Test void U05_unavailable_erp_never_grants_credit() {
        when(histories.current(1L)).thenReturn(false);
        assertThat(service.account(1L)).containsEntry("eligible", false)
            .containsEntry("reason", "No hay un historial ERP vigente. Puedes pagar con PayKlik.");
    }

    @Test void U06_pending_incident_blocks_credit() {
        pending = 1;
        assertThat(service.account(1L)).containsEntry("eligible", false)
            .containsEntry("reason", "Hay una solicitud de cambio o devolución en revisión");
    }

    @Test void U07_available_balance_never_becomes_negative() {
        used = new BigDecimal("1001");
        assertThat(service.account(1L).get("available")).isEqualTo(BigDecimal.ZERO);
    }

    @Test void U08_existing_debt_reduces_available_balance() {
        used = new BigDecimal("200.50");
        assertThat((BigDecimal) service.account(1L).get("available")).isEqualByComparingTo("799.50");
    }
}
