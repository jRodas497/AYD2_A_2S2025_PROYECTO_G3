package com.sgologic.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.sgologic.common.Channel;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Registro de auditoría transversal (DC-07). Escribe en audit.audit_log, que es de solo
 * inserción: la base rechaza un UPDATE o un DELETE y al rol de la aplicación ni siquiera se le
 * dio ese permiso (ADR-0006).
 *
 * <p>Se escribe dentro de la misma transacción que el hecho auditado a propósito: si el hecho
 * ocurre, su registro existe; si el registro no se puede escribir, el hecho se revierte. Eso
 * incluye el caso en que la base rechace el texto por contener algo que parece un número de
 * tarjeta (DC-08, V4__guardia_de_tarjetas.sql) — es la barrera funcionando, no un bug.
 */
@Service
public class AuditService {

    private final JdbcTemplate jdbc;
    private final com.fasterxml.jackson.databind.ObjectMapper json;

    public AuditService(JdbcTemplate jdbc, com.fasterxml.jackson.databind.ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public void record(
            String actor, String action, String entityType, Object entityId,
            Long orderId, Channel channel, Map<String, Object> details) {
        jdbc.update(
                """
                insert into audit.audit_log (actor, action, entity_type, entity_id, order_id, channel_id, details)
                values (?, ?, ?, ?, ?, ?, ?::jsonb)
                """,
                actor,
                action,
                entityType,
                String.valueOf(entityId),
                orderId,
                channel == null ? null : channel.id(),
                toJson(details == null ? Map.of() : details));
    }

    /** Registro de un hecho del sistema sobre una orden, que es la mayoría de los casos. */
    public void recordSystem(String action, String entityType, Object entityId, Long orderId,
                             Channel channel, Map<String, Object> details) {
        record("system", action, entityType, entityId, orderId, channel, details);
    }

    private String toJson(Map<String, Object> details) {
        try {
            return json.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("no se pudo serializar el detalle de auditoría", e);
        }
    }

    public static String currentActor() {
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        return auth==null || !auth.isAuthenticated() || auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken ? "system" : auth.getName();
    }
}
