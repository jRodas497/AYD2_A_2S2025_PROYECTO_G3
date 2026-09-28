package com.sgologic.orders;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Bandeja global de incidencias (cambios y devoluciones) para el backoffice: la vista que
 * {@link IncidentRepository} no puede dar porque está pensada para consultarse por orden o por
 * cliente, no para listar todo el sistema.
 */
@Service
public class IncidentQueryService {

    private final JdbcTemplate jdbc;

    public IncidentQueryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<IncidentOverview> search(IncidentStatus status, IncidentType type, int limit) {
        StringBuilder sql = new StringBuilder(
                """
                select i.id, i.order_id, o.customer_id, c.full_name as customer, i.type_id, i.status_id,
                       i.description, o.total, i.created_at, i.resolved_at
                from orders.incident i
                join orders.purchase_order o on o.id = i.order_id
                join customers.customer c on c.id = o.customer_id
                where 1 = 1
                """);
        List<Object> args = new ArrayList<>();
        if (status != null) {
            sql.append(" and i.status_id = ?");
            args.add(status.id());
        }
        if (type != null) {
            sql.append(" and i.type_id = ?");
            args.add(type.id());
        }
        sql.append(" order by i.created_at desc limit ?");
        args.add(limit);
        return jdbc.query(
                sql.toString(),
                (rs, rowNum) -> new IncidentOverview(
                        rs.getLong("id"),
                        rs.getLong("order_id"),
                        rs.getLong("customer_id"),
                        rs.getString("customer"),
                        IncidentType.fromId(rs.getShort("type_id")).code(),
                        IncidentStatus.fromId(rs.getShort("status_id")).code(),
                        rs.getString("description"),
                        rs.getBigDecimal("total"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("resolved_at", OffsetDateTime.class)),
                args.toArray());
    }

    /** Una incidencia con el contexto de su orden y cliente, para la bandeja del backoffice. */
    public record IncidentOverview(
            Long id,
            Long orderId,
            Long customerId,
            String customer,
            String type,
            String status,
            String description,
            BigDecimal orderTotal,
            OffsetDateTime createdAt,
            OffsetDateTime resolvedAt) {
    }
}
