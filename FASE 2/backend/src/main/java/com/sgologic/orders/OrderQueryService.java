package com.sgologic.orders;

import com.sgologic.orders.dto.OrderOverview;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

/** RC01: estado completo de una orden en una sola consulta, la vista ya lo deja resuelto. */
@Service
public class OrderQueryService {

    private static final String COLUMNS =
            "order_id, created_at, customer_id, customer, channel, status, total, "
                    + "last_payment_result, payment_attempts, invoice_status, shipment_status, tracking_number, "
                    + "(select delivery_address from orders.purchase_order o where o.id=order_overview.order_id) as delivery_address, "
                    + "(select coalesce(jsonb_agg(jsonb_build_object('productId',p.id,'nombre',p.name,'sku',p.sku,'cantidad',oi.quantity,'precioUnitario',oi.unit_price)), '[]'::jsonb) "
                    + "from orders.order_item oi join catalog.product p on p.id=oi.product_id where oi.order_id=order_overview.order_id) as items, "
                    + "(select payment_preference from orders.purchase_order o where o.id=order_overview.order_id) as payment_preference";

    private final JdbcTemplate jdbc;

    public OrderQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<OrderOverview> findOverview(Long orderId) {
        try {
            OrderOverview overview = jdbc.queryForObject(
                    "select " + COLUMNS + " from orders.order_overview where order_id = ?",
                    mapper(),
                    orderId);
            return Optional.ofNullable(overview);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    /**
     * Listado/búsqueda de órdenes para el backoffice (PB-042): todos los filtros son opcionales
     * y se combinan. {@code q} busca por número de orden exacto o por nombre de cliente parcial.
     */
    public List<OrderOverview> search(String status, Long customerId, String channel, String q, int limit) {
        StringBuilder sql = new StringBuilder("select " + COLUMNS + " from orders.order_overview where 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" and status = ?");
            args.add(status.trim().toUpperCase());
        }
        if (customerId != null) {
            sql.append(" and customer_id = ?");
            args.add(customerId);
        }
        if (channel != null && !channel.isBlank()) {
            sql.append(" and channel = ?");
            args.add(channel.trim().toUpperCase());
        }
        if (q != null && !q.isBlank()) {
            String texto = q.trim();
            sql.append(" and (cast(order_id as text) = ? or customer ilike ?)");
            args.add(texto);
            args.add("%" + texto + "%");
        }
        sql.append(" order by created_at desc limit ?");
        args.add(Math.max(1,Math.min(500,limit)));
        return jdbc.query(sql.toString(), mapper(), args.toArray());
    }

    @SuppressWarnings("unchecked")
    private static java.util.List<java.util.Map<String,Object>> parseItems(String value) {
        try { return new com.fasterxml.jackson.databind.ObjectMapper().readValue(value, java.util.List.class); }
        catch(Exception e) { throw new IllegalStateException("detalle de orden inválido",e); }
    }

    private static RowMapper<OrderOverview> mapper() {
        return (rs, rowNum) -> new OrderOverview(
                rs.getLong("order_id"),
                rs.getObject("created_at", java.time.OffsetDateTime.class),
                rs.getLong("customer_id"),
                rs.getString("customer"),
                rs.getString("channel"),
                rs.getString("status"),
                rs.getBigDecimal("total"),
                rs.getString("last_payment_result"),
                // count(*) over () viene como bigint: castear a Integer directo
                // reventaba en cuanto la orden tenía un intento de cobro.
                rs.getObject("payment_attempts") == null
                        ? null
                        : ((Number) rs.getObject("payment_attempts")).intValue(),
                rs.getString("invoice_status"),
                rs.getString("shipment_status"),
                rs.getString("tracking_number"),
                rs.getString("delivery_address"),
                parseItems(rs.getString("items")),rs.getString("payment_preference"));
    }
}
