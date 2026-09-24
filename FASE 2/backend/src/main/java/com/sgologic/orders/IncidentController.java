package com.sgologic.orders;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Registrar atención: cambios y devoluciones de una orden (CDU-05, Atención al Cliente). */
@RestController
@RequestMapping("/api")
public class IncidentController {

    private final IncidentService incidents;

    public IncidentController(IncidentService incidents) {
        this.incidents = incidents;
    }

    @PostMapping("/orders/{orderId}/incidents")
    @ResponseStatus(HttpStatus.CREATED)
    public IncidentService.Incident register(@PathVariable Long orderId, @Valid @RequestBody NewIncident body) {
        return incidents.register(orderId, body.type(), body.description(), body.actor());
    }

    @GetMapping("/orders/{orderId}/incidents")
    public List<IncidentService.Incident> ofOrder(@PathVariable Long orderId) {
        return incidents.ofOrder(orderId);
    }

    @GetMapping("/incidents/{id}")
    public IncidentService.Incident get(@PathVariable Long id) {
        return incidents.find(id);
    }

    /** Avanza la atención: IN_PROCESS, RESOLVED o REJECTED. Una devolución resuelta deja la orden en RETURNED. */
    @PatchMapping("/incidents/{id}")
    public IncidentService.Incident changeStatus(@PathVariable Long id, @Valid @RequestBody StatusChange body) {
        return incidents.changeStatus(id, body.status(), body.note(), body.actor());
    }

    /** {@code actor} es quien atiende (por ejemplo, el usuario del agente); sin login, se registra tal cual llega. */
    public record NewIncident(@NotNull IncidentType type, @NotBlank String description, String actor) {
    }

    public record StatusChange(@NotNull IncidentStatus status, String note, String actor) {
    }
}
