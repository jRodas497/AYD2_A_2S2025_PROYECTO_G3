package com.sgologic.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Consultas sobre la auditoría (DC-04, DC-07). Los filtros están hechos a la medida de los
 * índices que ya tiene la tabla —por orden, por entidad y por fecha— para que recuperar la
 * evidencia de una operación no dependa de recorrer todo el historial.
 */
@Service
public class AuditQueryService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public AuditQueryService(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<AuditEntry> search(
            Long orderId, String entityType, String entityId, String action,
            OffsetDateTime from, OffsetDateTime to, int limit) {

        StringBuilder sql = new StringBuilder(
                "select id, occurred_at, actor, action, entity_type, entity_id, order_id, "
                        + "channel_id, details::text as details from audit.audit_log where 1 = 1");
        List<Object> args = new ArrayList<>();

        if (orderId != null) {
            sql.append(" and order_id = ?");
            args.add(orderId);
        }
        if (entityType != null && !entityType.isBlank()) {
            sql.append(" and entity_type = ?");
            args.add(entityType);
        }
        if (entityId != null && !entityId.isBlank()) {
            sql.append(" and entity_id = ?");
            args.add(entityId);
        }
        if (action != null && !action.isBlank()) {
            sql.append(" and action = ?");
            args.add(action);
        }
        if (from != null) {
            sql.append(" and occurred_at >= ?");
            args.add(from);
        }
        if (to != null) {
            sql.append(" and occurred_at <= ?");
            args.add(to);
        }
        sql.append(" order by occurred_at desc, id desc limit ?");
        args.add(limit);

        return jdbc.query(sql.toString(), this::mapEntry, args.toArray());
    }

    /** La historia completa de una orden, en el orden en que pasó. */
    public List<AuditEntry> timelineOf(Long orderId) {
        return jdbc.query(
                """
                select id, occurred_at, actor, action, entity_type, entity_id, order_id,
                       channel_id, details::text as details
                from audit.audit_log
                where order_id = ?
                order by occurred_at, id
                """,
                this::mapEntry, orderId);
    }

    @SuppressWarnings("unchecked")
    private AuditEntry mapEntry(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        Map<String, Object> details;
        try {
            details = json.readValue(rs.getString("details"), Map.class);
        } catch (Exception e) {
            details = Map.of("raw", String.valueOf(rs.getString("details")));
        }
        // El driver devuelve smallint como Integer, así que se lee por Number y no por cast.
        Number channelId = (Number) rs.getObject("channel_id");
        return new AuditEntry(
                rs.getLong("id"),
                rs.getObject("occurred_at", OffsetDateTime.class),
                rs.getString("actor"),
                rs.getString("action"),
                rs.getString("entity_type"),
                rs.getString("entity_id"),
                (Long) rs.getObject("order_id"),
                channelId == null ? null : com.sgologic.common.Channel.fromId(channelId.shortValue()).code(),
                details);
    }

    /** Una línea del registro de auditoría. */
    public record AuditEntry(
            Long id,
            OffsetDateTime occurredAt,
            String actor,
            String action,
            String entityType,
            String entityId,
            Long orderId,
            String channel,
            Map<String, Object> details) {
    }
}
