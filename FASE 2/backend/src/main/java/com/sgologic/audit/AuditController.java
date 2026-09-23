package com.sgologic.audit;

import com.sgologic.orders.OrderQueryService;
import com.sgologic.orders.dto.OrderOverview;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Consulta de la auditoría (DC-07) y trazabilidad de una orden (DC-04).
 *
 * <p>Nada de esto tiene un endpoint de escritura: la auditoría se escribe sola, desde el
 * módulo que hace cada operación, y la base no admite modificarla después.
 */
@RestController
@RequestMapping("/api")
public class AuditController {

    private final AuditQueryService auditQueries;
    private final OrderQueryService orderQueries;

    public AuditController(AuditQueryService auditQueries, OrderQueryService orderQueries) {
        this.auditQueries = auditQueries;
        this.orderQueries = orderQueries;
    }

    /**
     * Busca en el registro de auditoría. Todos los filtros son opcionales y se combinan.
     * Ejemplos: {@code ?orderId=12}, {@code ?action=COBRO_APPROVED}, {@code ?entityType=invoice}.
     */
    @GetMapping("/audit")
    public List<AuditQueryService.AuditEntry> search(
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "100") int limit) {
        return auditQueries.search(orderId, entityType, entityId, action, from, to, limit);
    }

    /**
     * Todo lo que le pasó a una orden, de principio a fin: el estado en el que está y cada
     * paso registrado —cobros, factura, despacho, guía, entrega— en el orden en que ocurrió.
     */
    @GetMapping("/orders/{orderId}/trace")
    public OrderTrace trace(@PathVariable Long orderId) {
        OrderOverview overview = orderQueries.findOverview(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
        return new OrderTrace(overview, auditQueries.timelineOf(orderId));
    }

    public record OrderTrace(OrderOverview order, List<AuditQueryService.AuditEntry> timeline) {
    }
}
