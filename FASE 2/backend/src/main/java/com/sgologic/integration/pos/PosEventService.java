package com.sgologic.integration.pos;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgologic.common.DeliveryStatus;
import com.sgologic.external.PosClient;
import com.sgologic.external.ProviderUnavailableException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Comunicación con el POS local de las 32 tiendas. El POS no se modifica (DR-05): SGO-Logic
 * solo le empuja eventos de actualización.
 *
 * <p>Funciona igual que el outbox: el evento se encola dentro de la transacción del hecho que lo
 * origina y se entrega después, con reintentos y espera creciente. Así una tienda con la red
 * caída no detiene el despacho de las demás — lo que le pasa es que acumula eventos pendientes
 * que se entregan cuando vuelve.
 *
 * <p>La base solo acepta eventos de tiendas, nunca de un centro de distribución: la llave
 * foránea de {@code pos_event} lo hace cumplir.
 */
@Service
public class PosEventService {

    private static final Logger log = LoggerFactory.getLogger(PosEventService.class);

    public static final String STOCK_ADJUSTED = "StockAdjusted";

    private final JdbcTemplate jdbc;
    private final PosClient pos;
    private final ObjectMapper json;

    @Value("${sgologic.pos.max-attempts:5}")
    private int maxAttempts;

    @Value("${sgologic.pos.batch-size:25}")
    private int batchSize;

    @Value("${sgologic.pos.base-backoff-seconds:5}")
    private long baseBackoffSeconds;

    public PosEventService(JdbcTemplate jdbc, PosClient pos, ObjectMapper json) {
        this.jdbc = jdbc;
        this.pos = pos;
        this.json = json;
    }

    /** Encola un evento para el POS de una tienda. Se llama dentro de la transacción del hecho. */
    public Long publish(Long storeId, String eventType, Map<String, Object> payload) {
        return jdbc.queryForObject(
                """
                insert into integration.pos_event (store_id, event_type, payload)
                values (?, ?, ?::jsonb)
                returning id
                """,
                Long.class, storeId, eventType, toJson(payload));
    }

    /** Entrega los eventos pendientes cuya próxima cita ya llegó. 1 = PENDING. */
    @Transactional
    public int deliverPending() {
        List<PosEvent> pending = jdbc.query(
                """
                select e.id, e.store_id, l.code as store_code, e.event_type, e.payload::text as payload,
                       e.status_id, e.attempts, e.last_error, e.created_at, e.delivered_at
                from integration.pos_event e
                join inventory.location l on l.id = e.store_id
                where e.status_id = 1 and e.next_attempt_at <= now()
                order by e.id
                limit ?
                """,
                mapper(), batchSize);

        int delivered = 0;
        for (PosEvent event : pending) {
            if (deliver(event)) {
                delivered++;
            }
        }
        return delivered;
    }

    private boolean deliver(PosEvent event) {
        int attempts = event.attempts() + 1;
        try {
            pos.deliver(event.storeCode(), event.eventType(), event.payload());
            jdbc.update(
                    "update integration.pos_event set status_id = 2, attempts = ?, delivered_at = now(), "
                            + "last_error = null where id = ?",
                    attempts, event.id());
            return true;
        } catch (ProviderUnavailableException e) {
            if (attempts >= maxAttempts) {
                log.warn("el POS de {} no recibió el evento {} tras {} intentos", event.storeCode(), event.id(),
                        attempts);
                jdbc.update(
                        "update integration.pos_event set status_id = 3, attempts = ?, last_error = ? where id = ?",
                        attempts, e.getMessage(), event.id());
            } else {
                jdbc.update(
                        """
                        update integration.pos_event
                        set attempts = ?, next_attempt_at = now() + make_interval(secs => ?), last_error = ?
                        where id = ?
                        """,
                        attempts, (double) (baseBackoffSeconds * (1L << (attempts - 1))), e.getMessage(), event.id());
            }
            return false;
        }
    }

    public java.util.Optional<PosEvent> byId(Long id) {
        List<PosEvent> found = jdbc.query(
                """
                select e.id, e.store_id, l.code as store_code, e.event_type, e.payload::text as payload,
                       e.status_id, e.attempts, e.last_error, e.created_at, e.delivered_at
                from integration.pos_event e
                join inventory.location l on l.id = e.store_id
                where e.id = ?
                """,
                mapper(), id);
        return found.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(found.get(0));
    }

    public List<PosEvent> byStatus(DeliveryStatus status, int limit) {
        return jdbc.query(
                """
                select e.id, e.store_id, l.code as store_code, e.event_type, e.payload::text as payload,
                       e.status_id, e.attempts, e.last_error, e.created_at, e.delivered_at
                from integration.pos_event e
                join inventory.location l on l.id = e.store_id
                where e.status_id = ?
                order by e.id desc
                limit ?
                """,
                mapper(), status.id(), limit);
    }

    /** Vuelve a encolar un evento que se dio por perdido, para cuando la tienda ya se recuperó. */
    @Transactional
    public int requeue(Long id) {
        return jdbc.update(
                "update integration.pos_event set status_id = 1, attempts = 0, next_attempt_at = now(), "
                        + "delivered_at = null where id = ?",
                id);
    }

    public Map<String, Long> countByStatus() {
        return jdbc.query(
                """
                select s.code, count(e.id) as total
                from config.delivery_status s
                left join integration.pos_event e on e.status_id = s.id
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

    private RowMapper<PosEvent> mapper() {
        return (rs, rowNum) -> new PosEvent(
                rs.getLong("id"),
                rs.getLong("store_id"),
                rs.getString("store_code"),
                rs.getString("event_type"),
                rs.getString("payload"),
                DeliveryStatus.fromId(rs.getShort("status_id")),
                rs.getInt("attempts"),
                rs.getString("last_error"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("delivered_at", OffsetDateTime.class));
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return json.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("no se pudo serializar el evento del POS", e);
        }
    }
}
