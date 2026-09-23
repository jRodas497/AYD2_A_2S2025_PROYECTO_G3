package com.sgologic.logistics;

import com.sgologic.external.ProviderUnavailableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Despacho y rastreo de una orden (CDU-04). */
@RestController
@RequestMapping("/api")
public class ShipmentController {

    private final DispatchService dispatch;

    public ShipmentController(DispatchService dispatch) {
        this.dispatch = dispatch;
    }

    /** El envío de una orden, con toda su línea de tiempo de rastreo. */
    @GetMapping("/orders/{orderId}/shipment")
    public ShipmentView ofOrder(@PathVariable Long orderId) {
        return view(dispatch.ofOrder(orderId));
    }

    /**
     * Despacha la orden a mano. Normalmente lo dispara solo el evento de facturación; esto es
     * para reanudarlo cuando quedó pendiente.
     */
    @PostMapping("/orders/{orderId}/dispatch")
    public ShipmentView dispatchOrder(@PathVariable Long orderId) {
        try {
            return view(dispatch.dispatch(orderId));
        } catch (ProviderUnavailableException e) {
            // El despacho sí se hizo; lo que falló fue la guía, y se reintenta solo.
            return view(dispatch.ofOrder(orderId));
        }
    }

    @GetMapping("/shipments/{id}")
    public ShipmentView byId(@PathVariable Long id) {
        return view(dispatch.byId(id));
    }

    /**
     * Los envíos por estado. {@code status=GUIDE_REQUESTED} es el panel de alertas de Logística:
     * envíos preparados que siguen sin número de guía (CDU-04, E1).
     */
    @GetMapping("/shipments")
    public List<ShipmentView> byStatus(
            @RequestParam(defaultValue = "GUIDE_REQUESTED") String status,
            @RequestParam(defaultValue = "50") int limit) {
        return dispatch.byStatus(parse(status), limit).stream().map(this::view).toList();
    }

    /** Vuelve a pedirle la guía a LogiExpress, para resolver una alerta a mano. */
    @PostMapping("/shipments/{id}/guide")
    public ShipmentView requestGuide(@PathVariable Long id) {
        try {
            return view(dispatch.requestGuide(id));
        } catch (ProviderUnavailableException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    /** Actualización de estado que manda LogiExpress (o Logística, si va a mano). */
    @PostMapping("/shipments/{id}/tracking")
    public ShipmentView track(@PathVariable Long id, @Valid @RequestBody TrackingUpdate body) {
        return view(dispatch.applyTrackingUpdate(id, parse(body.status()), body.detail()));
    }

    /** Cambia el punto de despacho después de confirmada la compra (CDU-04, flujo 1a). */
    @PutMapping("/shipments/{id}/origin")
    public ShipmentView reassign(@PathVariable Long id, @Valid @RequestBody OriginUpdate body) {
        return view(dispatch.reassign(id, body.locationCode()));
    }

    private ShipmentView view(Shipment shipment) {
        List<TrackingView> tracking = dispatch.trackingOf(shipment.getId()).stream()
                .map(e -> new TrackingView(e.getStatus().code(), e.getDetail(), e.getOccurredAt()))
                .toList();
        return new ShipmentView(
                shipment.getId(),
                shipment.getOrderId(),
                dispatch.locationCodeOf(shipment.getOriginLocationId()),
                shipment.getCarrier().code(),
                shipment.getStatus().code(),
                shipment.getTrackingNumber(),
                shipment.getCreatedAt(),
                shipment.getUpdatedAt(),
                tracking);
    }

    private static ShipmentStatus parse(String status) {
        try {
            return ShipmentStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "estado desconocido: " + status
                            + " (ASSIGNED, GUIDE_REQUESTED, GUIDE_ISSUED, IN_TRANSIT, DELIVERED, FAILED)");
        }
    }

    public record TrackingUpdate(@NotBlank String status, String detail) {
    }

    public record OriginUpdate(@NotBlank String locationCode) {
    }

    public record TrackingView(String status, String detail, OffsetDateTime occurredAt) {
    }

    public record ShipmentView(
            Long id,
            Long orderId,
            String originLocation,
            String carrier,
            String status,
            String trackingNumber,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt,
            List<TrackingView> tracking) {
    }
}
