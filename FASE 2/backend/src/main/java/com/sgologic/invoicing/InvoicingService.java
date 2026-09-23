package com.sgologic.invoicing;

import com.sgologic.audit.AuditService;
import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.external.SatClient;
import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxService;
import com.sgologic.orders.OrderStatus;
import com.sgologic.orders.PurchaseOrder;
import com.sgologic.orders.PurchaseOrderRepository;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Emite la factura electrónica de una orden pagada y la transmite a la SAT (CDU-03).
 *
 * <p>La regla dura del caso está implementada aquí: la orden solo pasa a INVOICED —y por lo
 * tanto solo se vuelve despachable— cuando la SAT acepta el documento. Si la SAT rechaza o no
 * responde, esto lanza y el evento vuelve a la cola: la orden se queda retenida antes de
 * despacho, nunca sale mercancía sin respaldo fiscal.
 *
 * <p>Emitir dos veces no genera dos facturas: {@code invoicing.invoice.order_id} es único y el
 * documento conserva su número de autorización entre reintentos.
 */
@Service
public class InvoicingService {

    private static final Logger log = LoggerFactory.getLogger(InvoicingService.class);

    private final InvoiceRepository invoices;
    private final PurchaseOrderRepository orders;
    private final InvoiceXmlBuilder xmlBuilder;
    private final SatClient sat;
    private final OutboxService outbox;
    private final AuditService audit;
    private final TransactionTemplate tx;

    @Value("${sgologic.invoicing.series:A}")
    private String series;

    public InvoicingService(
            InvoiceRepository invoices,
            PurchaseOrderRepository orders,
            InvoiceXmlBuilder xmlBuilder,
            SatClient sat,
            OutboxService outbox,
            AuditService audit,
            TransactionTemplate tx) {
        this.invoices = invoices;
        this.orders = orders;
        this.xmlBuilder = xmlBuilder;
        this.sat = sat;
        this.outbox = outbox;
        this.audit = audit;
        this.tx = tx;
    }

    /**
     * Genera (o recupera) la factura de la orden y la manda a la SAT.
     *
     * @throws ResponseStatusException 409 si la orden todavía no está pagada
     * @throws IllegalStateException si la SAT rechaza el documento, para que el evento se reintente
     * @throws ProviderUnavailableException si la SAT no responde, por lo mismo
     */
    public Invoice issue(Long orderId) {
        Prepared prepared = tx.execute(status -> prepare(orderId));
        if (prepared == null) {
            return invoices.findByOrderId(orderId).orElseThrow();
        }

        SatClient.SatResponse response;
        try {
            response = sat.send(prepared.cui(), prepared.xml());
        } catch (ProviderUnavailableException e) {
            tx.executeWithoutResult(status -> markSent(prepared.invoiceId(), orderId, e.getMessage()));
            throw e;
        }

        Invoice invoice = tx.execute(status -> apply(orderId, prepared.invoiceId(), response));
        if (!response.accepted()) {
            // CDU-03 E1: la orden no avanza a despacho hasta que exista una factura válida.
            throw new IllegalStateException("la SAT rechazó la factura de la orden " + orderId
                    + ": " + response.message());
        }
        return invoice;
    }

    /**
     * Se agotaron los reintentos con la SAT (CDU-03, E2): queda como incidencia auditable para
     * revisión manual y la orden sigue retenida antes de despacho.
     */
    public void escalate(Long orderId, String lastError) {
        tx.executeWithoutResult(status -> {
            PurchaseOrder order = load(orderId);
            audit.recordSystem("FACTURA_ESCALADA", "order", orderId, orderId, order.getChannel(),
                    Map.of("motivo", String.valueOf(lastError),
                           "accion", "revisión manual; la orden queda retenida antes de despacho"));
            log.error("la factura de la orden {} necesita revisión manual: {}", orderId, lastError);
        });
    }

    private Prepared prepare(Long orderId) {
        PurchaseOrder order = load(orderId);
        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                || order.getStatus() == OrderStatus.PAYMENT_IN_PROGRESS
                || order.getStatus() == OrderStatus.PAYMENT_FAILED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "la orden " + orderId + " no está pagada; no se puede facturar antes de cobrar");
        }
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "la orden " + orderId + " está cancelada");
        }

        Optional<Invoice> existing = invoices.findByOrderId(orderId);
        if (existing.isPresent() && existing.get().getStatus() == InvoiceStatus.ACCEPTED) {
            return null; // ya facturada: reintentar no emite un documento nuevo
        }

        Invoice invoice = existing.orElseGet(() -> {
            Invoice fresh = new Invoice();
            fresh.setOrderId(orderId);
            fresh.setCui(newAuthorizationNumber());
            fresh.setSeries(series);
            return fresh;
        });
        invoice.setXml(xmlBuilder.build(orderId, invoice.getCui(), invoice.getSeries()));
        invoice.setStatus(InvoiceStatus.GENERATED);
        invoice = invoices.save(invoice);

        audit.recordSystem("FACTURA_GENERADA", "invoice", invoice.getId(), orderId, order.getChannel(),
                Map.of("cui", invoice.getCui(), "serie", invoice.getSeries()));
        return new Prepared(invoice.getId(), invoice.getCui(), invoice.getXml());
    }

    /** La factura salió hacia la SAT pero no hubo respuesta: queda como enviada, a la espera. */
    private void markSent(Long invoiceId, Long orderId, String error) {
        Invoice invoice = invoices.findById(invoiceId).orElseThrow();
        invoice.setStatus(InvoiceStatus.SENT);
        invoice.setSatResponse("sin respuesta de la SAT: " + error);
        audit.recordSystem("FACTURA_SIN_RESPUESTA", "invoice", invoiceId, orderId, null,
                Map.of("motivo", String.valueOf(error)));
    }

    private Invoice apply(Long orderId, Long invoiceId, SatClient.SatResponse response) {
        Invoice invoice = invoices.findById(invoiceId).orElseThrow();
        PurchaseOrder order = load(orderId);

        invoice.setStatus(response.accepted() ? InvoiceStatus.ACCEPTED : InvoiceStatus.REJECTED);
        invoice.setSatResponse(response.message());
        invoice.setAnsweredAt(OffsetDateTime.now());

        if (response.accepted()) {
            order.setStatus(OrderStatus.INVOICED);
            order.setUpdatedAt(OffsetDateTime.now());
            outbox.publishForOrder(orderId, EventTypes.ORDER_INVOICED, Map.of("orderId", orderId));
            audit.recordSystem("FACTURA_ACEPTADA", "invoice", invoiceId, orderId, order.getChannel(),
                    Map.of("cui", invoice.getCui(), "serie", invoice.getSeries()));
            log.info("orden {} facturada con autorización {}", orderId, invoice.getCui());
        } else {
            audit.recordSystem("FACTURA_RECHAZADA", "invoice", invoiceId, orderId, order.getChannel(),
                    Map.of("motivo", response.message()));
        }
        return invoice;
    }

    public Invoice ofOrder(Long orderId) {
        return invoices.findByOrderId(orderId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "la orden " + orderId + " todavía no tiene factura"));
    }

    public java.util.List<Invoice> byStatus(InvoiceStatus status, int limit) {
        return invoices.findByStatusOrderByIdDesc(status, org.springframework.data.domain.Limit.of(limit));
    }

    /** Número de autorización del documento. Lleva letras: no es un número largo suelto. */
    private static String newAuthorizationNumber() {
        return UUID.randomUUID().toString().toUpperCase();
    }

    private PurchaseOrder load(Long orderId) {
        return orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
    }

    private record Prepared(Long invoiceId, String cui, String xml) {
    }
}
