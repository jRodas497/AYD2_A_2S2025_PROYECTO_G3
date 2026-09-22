package com.sgologic.inventory;

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
 * Reserva temporal de stock. Referencia (order_id, product_id) -> order_item y
 * (location_id, product_id) -> stock a nivel de base (ver V1__esquemas_y_tablas.sql);
 * aquí se guardan como columnas simples porque el backend no necesita navegar la relación.
 */
@Entity
@Table(name = "reservation", schema = "inventory")
@Getter
@Setter
@NoArgsConstructor
public class Reservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "location_id", nullable = false)
    private Long locationId;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = ReservationStatusConverter.class)
    private ReservationStatus status = ReservationStatus.ACTIVE;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "closed_at")
    private OffsetDateTime closedAt;
}
