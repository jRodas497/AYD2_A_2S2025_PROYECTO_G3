package com.sgologic.logistics;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Cada cambio de estado del envío, en orden. Es la trazabilidad del despacho. */
@Entity
@Table(name = "tracking_event", schema = "logistics")
@Getter
@Setter
@NoArgsConstructor
public class TrackingEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "shipment_id", nullable = false)
    private Long shipmentId;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = ShipmentStatusConverter.class)
    private ShipmentStatus status;

    private String detail;

    @Column(name = "occurred_at", insertable = false, updatable = false)
    private OffsetDateTime occurredAt;

    public TrackingEvent(Long shipmentId, ShipmentStatus status, String detail) {
        this.shipmentId = shipmentId;
        this.status = status;
        this.detail = detail;
    }
}
