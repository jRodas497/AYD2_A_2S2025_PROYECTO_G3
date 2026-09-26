package com.sgologic.integration.erp;

import java.util.List;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Conciliación con el ERP-Core (CDU-07). Lo que Finanzas necesita para investigar una
 * diferencia sin revisar a mano: qué lote incluyó qué órdenes, por cuánto y cuándo se entregó.
 */
@RestController
@RequestMapping("/api/integration/erp")
public class ErpController {

    private final ErpBatchService batches;

    public ErpController(ErpBatchService batches) {
        this.batches = batches;
    }

    /** Cierra la ventana ahora mismo, sin esperar los 30 minutos. Útil para la demo. */
    @PostMapping("/batches")
    public BatchGeneration generate() {
        try {
            return batches.generateBatch()
                    .map(id -> new BatchGeneration(true, batches.summary(id), null))
                    .orElseGet(() -> new BatchGeneration(
                            false, null, "no hay ventas facturadas pendientes de conciliar"));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "ya existe un lote para esta ventana; espera al siguiente intervalo");
        }
    }

    @GetMapping("/batches")
    public List<Map<String, Object>> list(@RequestParam(defaultValue = "20") int limit) {
        return batches.summaries(limit);
    }

    /** El detalle transaccional de un lote: el que evita la investigación manual (CDU-07, 3a). */
    @GetMapping("/batches/{id}")
    public BatchDetail detail(@PathVariable Long id) {
        Map<String, Object> summary = batches.summary(id);
        if (summary == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "lote no encontrado");
        }
        return new BatchDetail(summary, batches.salesOfBatch(id));
    }

    /** El archivo tal como lo recibe el AS/400. */
    @GetMapping(value = "/batches/{id}/file", produces = MediaType.TEXT_PLAIN_VALUE + ";charset=UTF-8")
    public String file(@PathVariable Long id) {
        if (batches.summary(id) == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "lote no encontrado");
        }
        return batches.content(id);
    }

    /** Reintenta a mano la entrega de un lote que quedó pendiente (CDU-07, E1). */
    @PostMapping("/batches/{id}/retry")
    public Map<String, Object> retry(@PathVariable Long id) {
        try {
            batches.retry(id);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "lote no encontrado");
        }
        return batches.summary(id);
    }

    public record BatchGeneration(boolean generated, Map<String, Object> batch, String message) {
    }

    public record BatchDetail(Map<String, Object> batch, List<ErpSale> orders) {
    }
}
