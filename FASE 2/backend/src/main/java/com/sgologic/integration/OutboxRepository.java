package com.sgologic.integration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgologic.common.DeliveryStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/**
 * Acceso a integration.outbox. Va por JdbcTemplate y no por JPA porque el payload es jsonb y
 * porque el reparto necesita SQL que el ORM no expresa bien: tomar en préstamo un lote de
 * eventos con {@code for update skip locked} para que dos hilos nunca procesen el mismo.
 */
@Repository
public class OutboxRepository {

    /**
     * Cuánto tiempo queda "en préstamo" un evento tomado por el repartidor. Si el proceso se
     * cae en medio del envío, el préstamo vence y otro lo vuelve a tomar: nunca se pierde.
     */
    private static final int LEASE_SECONDS = 120;

    private final JdbcTemplate jdbc;
    private final ObjectMapper json;

    public OutboxRepository(JdbcTemplate jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public Long publish(String aggregateType, Long aggregateId, String eventType, Map<String, Object> payload) {
        return jdbc.queryForObject(
                """
                insert into integration.outbox (aggregate_type, aggregate_id, event_type, payload)
                values (?, ?, ?, ?::jsonb)
                returning id
                """,
                Long.class, aggregateType, aggregateId, eventType, toJson(payload));
    }

    /**
     * Toma hasta {@code limit} eventos pendientes y les corre la próxima cita hacia adelante,
     * de modo que el siguiente barrido no los vuelva a tomar mientras se están enviando.
     * 1 = PENDING en config.delivery_status.
     */
    public List<OutboxEvent> lease(int limit) {
        return jdbc.query(
                """
                update integration.outbox
                set next_attempt_at = now() + make_interval(secs => ?)
                where id in (
                    select id from integration.outbox
                    where status_id = 1 and next_attempt_at <= now()
                    order by next_attempt_at
                    limit ?
                    for update skip locked
                )
                returning id, aggregate_type, aggregate_id, event_type, payload, attempts, created_at
                """,
                mapper(), (double) LEASE_SECONDS, limit);
    }

    public void markDelivered(Long id, int attempts) {
        jdbc.update(
                "update integration.outbox set status_id = 2, attempts = ?, processed_at = now(), "
                        + "last_error = null where id = ?",
                attempts, id);
    }

    public void markForRetry(Long id, int attempts, long backoffSeconds, String error) {
        jdbc.update(
                """
                update integration.outbox
                set attempts = ?, next_attempt_at = now() + make_interval(secs => ?), last_error = ?
                where id = ?
                """,
                attempts, (double) backoffSeconds, trim(error), id);
    }

    public void markFailed(Long id, int attempts, String error) {
        jdbc.update(
                "update integration.outbox set status_id = 3, attempts = ?, processed_at = now(), "
                        + "last_error = ? where id = ?",
                attempts, trim(error), id);
    }

    /** Vuelve a poner un evento en la cola, para la reanudación manual tras agotar reintentos. */
    public int requeue(Long id) {
        return jdbc.update(
                "update integration.outbox set status_id = 1, attempts = 0, next_attempt_at = now(), "
                        + "processed_at = null where id = ?",
                id);
    }

    public List<OutboxEvent> findByStatus(DeliveryStatus status, int limit) {
        return jdbc.query(
                """
                select id, aggregate_type, aggregate_id, event_type, payload, attempts, created_at
                from integration.outbox
                where status_id = ?
                order by id desc
                limit ?
                """,
                mapper(), status.id(), limit);
    }

    /** Profundidad de la cola por estado: la métrica que pide el monitoreo del ADR-0004. */
    public Map<String, Long> countByStatus() {
        return jdbc.query(
                """
                select s.code, count(o.id) as total
                from config.delivery_status s
                left join integration.outbox o on o.status_id = s.id
                group by s.code
                """,
                rs -> {
                    Map<String, Long> counts = new java.util.LinkedHashMap<>();
                    while (rs.next()) {
                        counts.put(rs.getString("code"), rs.getLong("total"));
                    }
                    return counts;
                });
    }

    private RowMapper<OutboxEvent> mapper() {
        return (rs, rowNum) -> new OutboxEvent(
                rs.getLong("id"),
                rs.getString("aggregate_type"),
                rs.getLong("aggregate_id"),
                rs.getString("event_type"),
                fromJson(rs.getString("payload")),
                rs.getInt("attempts"),
                rs.getObject("created_at", OffsetDateTime.class));
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return json.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("no se pudo serializar el payload del evento", e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String payload) {
        try {
            return json.readValue(payload, Map.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("payload de outbox ilegible", e);
        }
    }

    private static String trim(String error) {
        if (error == null) {
            return null;
        }
        return error.length() <= 500 ? error : error.substring(0, 500);
    }
}
