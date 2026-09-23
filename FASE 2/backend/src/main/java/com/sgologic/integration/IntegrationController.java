package com.sgologic.integration;

import com.sgologic.common.DeliveryStatus;
import com.sgologic.external.CircuitBreakers;
import com.sgologic.integration.pos.PosEventService;
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

    public IntegrationController(
            OutboxRepository outbox, PosEventService posEvents, CircuitBreakers breakers) {
        this.outbox = outbox;
        this.posEvents = posEvents;
        this.breakers = breakers;
    }

    /** Una sola pantalla: circuitos, cola de eventos y cola del POS. */
    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "circuitos", breakers.states(),
                "outbox", outbox.countByStatus(),
                "pos", posEvents.countByStatus());
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

    private static DeliveryStatus parse(String status) {
        try {
            return DeliveryStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "estado desconocido: " + status + " (PENDING, DELIVERED, FAILED)");
        }
    }
}
