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

/**
 * El envío de una orden. {@code origin_location_id} es el punto de despacho decidido por
 * Logística (CDU-04), no la ubicación que eligió la reserva del checkout: puede cambiar si el
 * cliente modifica el método de entrega después de comprar.
 */
@Entity
@Table(name = "shipment", schema = "logistics")
@Getter
@Setter
@NoArgsConstructor
public class Shipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "origin_location_id", nullable = false)
    private Long originLocationId;

    @Column(name = "carrier_id", nullable = false)
    @Convert(converter = CarrierConverter.class)
    private Carrier carrier = Carrier.LOGIEXPRESS;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = ShipmentStatusConverter.class)
    private ShipmentStatus status = ShipmentStatus.ASSIGNED;

    @Column(name = "tracking_number", unique = true)
    private String trackingNumber;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
}
