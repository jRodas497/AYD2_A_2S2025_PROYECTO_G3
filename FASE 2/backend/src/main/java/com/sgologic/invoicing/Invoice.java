package com.sgologic.invoicing;

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
 * La factura electrónica de una orden. {@code order_id} es único: una orden tiene una sola
 * factura, y eso es lo que hace que reintentar la emisión no genere documentos duplicados.
 */
@Entity
@Table(name = "invoice", schema = "invoicing")
@Getter
@Setter
@NoArgsConstructor
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private Long orderId;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = InvoiceStatusConverter.class)
    private InvoiceStatus status = InvoiceStatus.GENERATED;

    /** Número de autorización del documento. Se conserva aunque la SAT lo rechace y se reintente. */
    @Column(nullable = false)
    private String cui;

    @Column(nullable = false)
    private String series;

    @Column(nullable = false)
    private String xml;

    @Column(name = "sat_response")
    private String satResponse;

    @Column(name = "generated_at", insertable = false, updatable = false)
    private OffsetDateTime generatedAt;

    @Column(name = "answered_at")
    private OffsetDateTime answeredAt;
}
