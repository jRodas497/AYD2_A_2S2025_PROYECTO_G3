package com.sgologic.orders;

import com.sgologic.audit.AuditService;
import com.sgologic.notifications.NotificationService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Registro de atenciones: cambios y devoluciones sobre una orden (CDU-05, CDU expandido Atención
 * al Cliente). Cada alta y cada cambio de estado queda en la auditoría, que es lo que pide la hoja:
 * "cambios, devoluciones e incidencias auditables".
 *
 * <p>Una devolución resuelta deja la orden en RETURNED. El reembolso en sí (extender el flujo de
 * pago, CDU-05) no está en el MVP; queda registrado como la acción pendiente de la atención.
 */
@Service
public class IncidentService {

    /** Solo se atiende una orden cuyo cobro ya se aprobó: antes de eso no hay nada que cambiar ni devolver. */
    private static final Set<OrderStatus> ATTENDABLE =
            Set.of(OrderStatus.PAID, OrderStatus.INVOICED, OrderStatus.IN_DISPATCH, OrderStatus.DELIVERED);

    private final JdbcTemplate jdbc;
    private final PurchaseOrderRepository orders;
    private final AuditService audit;
    private final NotificationService notifications;

    public IncidentService(
            JdbcTemplate jdbc, PurchaseOrderRepository orders, AuditService audit, NotificationService notifications) {
        this.jdbc = jdbc;
        this.orders = orders;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional
    public Incident register(Long orderId, IncidentType type, String description, String actor) {
        PurchaseOrder order = orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
        if (!ATTENDABLE.contains(order.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "la orden " + orderId + " está " + order.getStatus().code()
                            + "; solo se registran cambios o devoluciones de órdenes ya pagadas");
        }

        Incident incident = jdbc.queryForObject(
                """
                insert into orders.incident (order_id, type_id, description)
                values (?, ?, ?)
                returning id, order_id, type_id, status_id, description, created_at, resolved_at
                """,
                mapper(), orderId, type.id(), description);

        audit.record(actorOf(actor), "ATENCION_REGISTRADA", "incident", incident.id(), orderId, order.getChannel(),
                Map.of("tipo", type.code(), "descripcion", description));
        notifications.queueForOrder(orderId,
                "Registramos tu solicitud de " + (type == IncidentType.RETURN ? "devolución" : "cambio")
                        + " de la orden " + orderId + " (atención " + incident.id() + ").");
        return incident;
    }

    @Transactional
    public Incident changeStatus(Long incidentId, IncidentStatus next, String note, String actor) {
        Incident current = find(incidentId);
        if (current.status().isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "la atención " + incidentId + " ya está " + current.status().code() + " y no se puede cambiar");
        }
        if (next == IncidentStatus.REGISTERED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "una atención no puede volver a REGISTERED");
        }

        jdbc.update(
                "update orders.incident set status_id = ?, resolved_at = case when ? then now() else null end where id = ?",
                next.id(), next.isClosed(), incidentId);

        PurchaseOrder order = orders.findById(current.orderId()).orElseThrow();
        if (next == IncidentStatus.RESOLVED && current.type() == IncidentType.RETURN) {
            order.setStatus(OrderStatus.RETURNED);
            order.setUpdatedAt(OffsetDateTime.now());
        }

        audit.record(actorOf(actor), "ATENCION_" + next.code(), "incident", incidentId, current.orderId(),
                order.getChannel(),
                Map.of("tipo", current.type().code(), "desde", current.status().code(), "hasta", next.code(),
                       "nota", note == null ? "" : note));
        if (next.isClosed()) {
            notifications.queueForOrder(current.orderId(),
                    "Tu solicitud " + incidentId + " de la orden " + current.orderId() + " fue "
                            + (next == IncidentStatus.RESOLVED ? "resuelta" : "rechazada") + ".");
        }
        return find(incidentId);
    }

    public Incident find(Long incidentId) {
        List<Incident> found = jdbc.query(
                "select id, order_id, type_id, status_id, description, created_at, resolved_at "
                        + "from orders.incident where id = ?",
                mapper(), incidentId);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "atención no encontrada");
        }
        return found.get(0);
    }

    public List<Incident> ofOrder(Long orderId) {
        return jdbc.query(
                "select id, order_id, type_id, status_id, description, created_at, resolved_at "
                        + "from orders.incident where order_id = ? order by id",
                mapper(), orderId);
    }

    public List<Incident> ofCustomer(Long customerId, int limit) {
        return jdbc.query(
                """
                select i.id, i.order_id, i.type_id, i.status_id, i.description, i.created_at, i.resolved_at
                from orders.incident i
                join orders.purchase_order o on o.id = i.order_id
                where o.customer_id = ?
                order by i.created_at desc
                limit ?
                """,
                mapper(), customerId, limit);
    }

    private static String actorOf(String actor) {
        return actor == null || actor.isBlank() ? "atencion-al-cliente" : actor;
    }

    private static RowMapper<Incident> mapper() {
        return (rs, rowNum) -> new Incident(
                rs.getLong("id"),
                rs.getLong("order_id"),
                IncidentType.fromId(rs.getShort("type_id")),
                IncidentStatus.fromId(rs.getShort("status_id")),
                rs.getString("description"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("resolved_at", OffsetDateTime.class));
    }

    /** Una atención sobre una orden. */
    public record Incident(
            Long id,
            Long orderId,
            IncidentType type,
            IncidentStatus status,
            String description,
            OffsetDateTime createdAt,
            OffsetDateTime resolvedAt) {
    }
}
