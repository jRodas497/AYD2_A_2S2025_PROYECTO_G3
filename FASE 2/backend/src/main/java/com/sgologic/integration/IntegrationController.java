package com.sgologic.integration;

import com.sgologic.common.DeliveryStatus;
import com.sgologic.external.CircuitBreakers;
import com.sgologic.integration.pos.PosEventService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Monitoreo de las integraciones: el estado de los circuitos y la profundidad de las colas.
 * Es lo que ADR-0002 y ADR-0004 dejan como condición para operar con estos patrones — un
 * circuit breaker sin forma de verlo es un punto ciego, no una protección.
 */
@RestController
@RequestMapping("/api/integration")
public class IntegrationController {

    private final OutboxRepository outbox;
    private final PosEventService posEvents;
    private final CircuitBreakers breakers;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public IntegrationController(
            OutboxRepository outbox, PosEventService posEvents, CircuitBreakers breakers,
            org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.outbox = outbox;
        this.posEvents = posEvents;
        this.breakers = breakers;
        this.jdbc = jdbc;
    }

    /** Una sola pantalla: circuitos, cola de eventos y cola del POS. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "circuitos", breakers.states(),
                "outbox", outbox.countByStatus(),
                "pos", posEvents.countByStatus(),
                "avisos", countByStatus("notifications.notification"),
                "erp", countByStatus("integration.erp_batch"));
    }

    /**
     * Los eventos del broker por estado. {@code status=FAILED} es la cola de los que agotaron
     * sus reintentos: cada uno trae el último error que dio.
     */
    @GetMapping("/outbox")
    public List<OutboxEvent> outbox(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "50") int limit) {
        return outbox.findByStatus(parse(status), limit);
    }

    /** Vuelve a encolar un evento que se dio por perdido, una vez resuelto lo que lo tumbó. */
    @PostMapping("/outbox/{id}/retry")
    public Map<String, Object> retry(@PathVariable Long id) {
        if (outbox.requeue(id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "evento no encontrado");
        }
        return Map.of("id", id, "status", DeliveryStatus.PENDING.code());
    }

    /** Entregados, pendientes y fallidos de una cola: la tasa de éxito que pide el ADR-0004. */
    private Map<String, Long> countByStatus(String table) {
        return jdbc.query(
                "select s.code, count(t.id) as total from config.delivery_status s "
                        + "left join " + table + " t on t.status_id = s.id group by s.code",
                rs -> {
                    Map<String, Long> counts = new LinkedHashMap<>();
                    while (rs.next()) {
                        counts.put(rs.getString("code"), rs.getLong("total"));
                    }
                    return counts;
                });
    }

    private static DeliveryStatus parse(String status) {
        try {
            return DeliveryStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "estado desconocido: " + status + " (PENDING, DELIVERED, FAILED)");
        }
    }
}
