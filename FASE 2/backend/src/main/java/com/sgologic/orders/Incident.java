package com.sgologic.orders;

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

/** Cambios y devoluciones (RF: Gestión de Incidencias), sobre una orden ya creada. */
@Entity
@Table(name = "incident", schema = "orders")
@Getter
@Setter
@NoArgsConstructor
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "type_id", nullable = false)
    @Convert(converter = IncidentTypeConverter.class)
    private IncidentType type;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = IncidentStatusConverter.class)
    private IncidentStatus status = IncidentStatus.REGISTERED;

    @Column(nullable = false)
    private String description;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;
    @Column(name="replacement_order_id")
    private Long replacementOrderId;
}
