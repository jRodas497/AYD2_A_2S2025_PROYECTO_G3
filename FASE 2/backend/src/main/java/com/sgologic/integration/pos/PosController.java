package com.sgologic.integration.pos;

import com.sgologic.common.DeliveryStatus;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Eventos hacia el POS de las tiendas (DR-05: el POS no se modifica, solo recibe). */
@RestController
@RequestMapping("/api/integration/pos")
public class PosController {

    private final PosEventService events;

    public PosController(PosEventService events) {
        this.events = events;
    }

    /** {@code status=FAILED} es la lista de tiendas que se quedaron sin recibir un evento. */
    @GetMapping("/events")
    public List<PosEvent> byStatus(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "50") int limit) {
        return events.byStatus(parse(status), limit);
    }

    @PostMapping("/events/{id}/retry")
    public PosEvent retry(@PathVariable Long id) {
        if (events.requeue(id) == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "evento no encontrado");
        }
        return events.byId(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "evento no encontrado"));
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
