package com.sgologic.invoicing;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Facturación electrónica de una orden (CDU-03). */
@RestController
@RequestMapping("/api")
public class InvoiceController {

    private final InvoicingService invoicing;

    public InvoiceController(InvoicingService invoicing) {
        this.invoicing = invoicing;
    }

    /** La factura de la orden, sin el XML (que es largo y tiene su propio endpoint). */
    @GetMapping("/orders/{orderId}/invoice")
    public InvoiceView ofOrder(@PathVariable Long orderId) {
        return InvoiceView.of(invoicing.ofOrder(orderId));
    }

    /** El XML tal cual se le transmitió a la SAT, con su CUI y su serie. */
    @GetMapping(value = "/orders/{orderId}/invoice/xml", produces = MediaType.APPLICATION_XML_VALUE)
    public String xml(@PathVariable Long orderId) {
        return invoicing.ofOrder(orderId).getXml();
    }

    /**
     * Emite o reintenta la factura a mano. Es lo que usa Finanzas cuando un documento quedó
     * escalado porque la SAT no respondió o lo rechazó (CDU-03, E1/E2).
     */
    @PostMapping("/orders/{orderId}/invoice")
    public InvoiceView issue(@PathVariable Long orderId) {
        try {
            return InvoiceView.of(invoicing.issue(orderId));
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    /** Las facturas por estado. Con {@code status=REJECTED} es la bandeja de revisión de Finanzas. */
    @GetMapping("/invoices")
    public List<InvoiceView> byStatus(
            @RequestParam(defaultValue = "ACCEPTED") String status,
            @RequestParam(defaultValue = "50") int limit) {
        return invoicing.byStatus(parse(status), limit).stream().map(InvoiceView::of).toList();
    }

    private static InvoiceStatus parse(String status) {
        try {
            return InvoiceStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "estado desconocido: " + status + " (GENERATED, SENT, ACCEPTED, REJECTED)");
        }
    }

    public record InvoiceView(
            Long id,
            Long orderId,
            String status,
            String cui,
            String series,
            String satResponse,
            OffsetDateTime generatedAt,
            OffsetDateTime answeredAt) {

        static InvoiceView of(Invoice invoice) {
            return new InvoiceView(
                    invoice.getId(), invoice.getOrderId(), invoice.getStatus().code(), invoice.getCui(),
                    invoice.getSeries(), invoice.getSatResponse(), invoice.getGeneratedAt(),
                    invoice.getAnsweredAt());
        }
    }
}
