package com.sgologic.orders;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IncidentController {

    private final IncidentService incidentService;
    private final IncidentQueryService incidentQueryService;

    public IncidentController(IncidentService incidentService, IncidentQueryService incidentQueryService) {
        this.incidentService = incidentService;
        this.incidentQueryService = incidentQueryService;
    }

    /**
     * Bandeja global de incidencias (RF Gestión de Incidencias): cambios y devoluciones de todas
     * las órdenes, filtrables por estado y tipo. {@code type=RETURN} es la pantalla de Devoluciones.
     */
    @GetMapping("/api/incidents")
    public List<IncidentQueryService.IncidentOverview> search(
            @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) IncidentType type,
            @RequestParam(defaultValue = "50") int limit) {
        return incidentQueryService.search(status, type, limit);
    }

    @PostMapping("/api/orders/{orderId}/incidents")
    @ResponseStatus(HttpStatus.CREATED)
    public Incident register(@PathVariable Long orderId, @Valid @RequestBody NewIncident body) {
        return incidentService.register(orderId, body.type(), body.description());
    }

    @GetMapping("/api/orders/{orderId}/incidents")
    public List<Incident> list(@PathVariable Long orderId) {
        return incidentService.findByOrder(orderId);
    }

    @GetMapping("/api/incidents/{id}")
    public Incident get(@PathVariable Long id) {
        return incidentService.findById(id);
    }

    /** Procesar la incidencia: pasarla a en proceso, resuelta o rechazada. */
    @PutMapping("/api/incidents/{id}/status")
    public Incident updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateIncidentStatus body) {
        return incidentService.updateStatus(id, body.status());
    }

    public record NewIncident(@NotNull IncidentType type, @NotBlank String description) {
    }

    public record UpdateIncidentStatus(@NotNull IncidentStatus status) {
    }
}
