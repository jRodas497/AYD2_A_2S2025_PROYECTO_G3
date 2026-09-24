package com.sgologic.orders;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** RF: Gestión de Incidencias — registrar y procesar cambios/devoluciones desde una vista centralizada. */
@Service
public class IncidentService {

    private final IncidentRepository incidents;
    private final PurchaseOrderRepository orders;

    public IncidentService(IncidentRepository incidents, PurchaseOrderRepository orders) {
        this.incidents = incidents;
        this.orders = orders;
    }

    @Transactional
    public Incident register(Long orderId, IncidentType type, String description) {
        if (!orders.existsById(orderId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada");
        }
        Incident incident = new Incident();
        incident.setOrderId(orderId);
        incident.setType(type);
        incident.setDescription(description);
        incident.setStatus(IncidentStatus.REGISTERED);
        return incidents.save(incident);
    }

    public List<Incident> findByOrder(Long orderId) {
        return incidents.findByOrderId(orderId);
    }

    @Transactional
    public Incident updateStatus(Long incidentId, IncidentStatus status) {
        Incident incident = incidents.findById(incidentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "incidencia no encontrada"));
        incident.setStatus(status);
        if (status == IncidentStatus.RESOLVED || status == IncidentStatus.REJECTED) {
            incident.setResolvedAt(OffsetDateTime.now());
        }
        return incidents.save(incident);
    }
}
