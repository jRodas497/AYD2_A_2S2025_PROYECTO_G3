package com.sgologic.payments;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * payments.payment_attempt. Va por JdbcTemplate y no por JPA a propósito: la tabla solo acepta
 * inserciones, y un ORM con su caché de primer nivel y su detección de cambios invita justo a lo
 * que la base prohíbe. Aquí solo hay INSERT y SELECT.
 */
@Repository
public class PaymentAttemptRepository {

    private final JdbcTemplate jdbc;

    public PaymentAttemptRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int nextAttemptNumber(Long orderId) {
        Integer next = jdbc.queryForObject(
                "select coalesce(max(attempt_number), 0) + 1 from payments.payment_attempt where order_id = ?",
                Integer.class, orderId);
        return next == null ? 1 : next;
    }

    public PaymentAttempt insert(
            Long orderId, int attemptNumber, PaymentResult result, BigDecimal amount,
            String providerReference, String cardLast4, String failureReason, Long latencyMs) {
        return jdbc.queryForObject(
                """
                insert into payments.payment_attempt
                    (order_id, attempt_number, result_id, amount, provider_reference, card_last4,
                     failure_reason, latency_ms)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                returning id, order_id, attempt_number, result_id, amount, provider_reference,
                          card_last4, failure_reason, latency_ms, attempted_at
                """,
                mapper(),
                orderId, attemptNumber, result.id(), amount, providerReference, cardLast4,
                failureReason, latencyMs == null ? null : latencyMs.intValue());
    }

    public List<PaymentAttempt> findByOrder(Long orderId) {
        return jdbc.query(
                """
                select id, order_id, attempt_number, result_id, amount, provider_reference,
                       card_last4, failure_reason, latency_ms, attempted_at
                from payments.payment_attempt
                where order_id = ?
                order by attempt_number
                """,
                mapper(), orderId);
    }

    private RowMapper<PaymentAttempt> mapper() {
        return (rs, rowNum) -> new PaymentAttempt(
                rs.getLong("id"),
                rs.getLong("order_id"),
                rs.getInt("attempt_number"),
                PaymentResult.fromId(rs.getShort("result_id")),
                rs.getBigDecimal("amount"),
                rs.getString("provider_reference"),
                rs.getString("card_last4"),
                rs.getString("failure_reason"),
                (Integer) rs.getObject("latency_ms"),
                rs.getObject("attempted_at", OffsetDateTime.class));
    }
}
