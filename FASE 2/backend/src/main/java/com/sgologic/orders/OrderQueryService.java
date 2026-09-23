package com.sgologic.orders;

import com.sgologic.orders.dto.OrderOverview;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** RC01: estado completo de una orden en una sola consulta, la vista ya lo deja resuelto. */
@Service
public class OrderQueryService {

    private final JdbcTemplate jdbc;

    public OrderQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<OrderOverview> findOverview(Long orderId) {
        try {
            OrderOverview overview = jdbc.queryForObject(
                    """
                    select order_id, created_at, customer_id, customer, channel, status, total,
                           last_payment_result, payment_attempts, invoice_status, shipment_status, tracking_number
                    from orders.order_overview
                    where order_id = ?
                    """,
                    (rs, rowNum) -> new OrderOverview(
                            rs.getLong("order_id"),
                            rs.getObject("created_at", java.time.OffsetDateTime.class),
                            rs.getLong("customer_id"),
                            rs.getString("customer"),
                            rs.getString("channel"),
                            rs.getString("status"),
                            rs.getBigDecimal("total"),
                            rs.getString("last_payment_result"),
                            (Integer) rs.getObject("payment_attempts"),
                            rs.getString("invoice_status"),
                            rs.getString("shipment_status"),
                            rs.getString("tracking_number")),
                    orderId);
            return Optional.ofNullable(overview);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }
}
