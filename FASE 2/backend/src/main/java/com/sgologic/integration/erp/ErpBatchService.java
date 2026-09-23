package com.sgologic.integration.erp;

import com.sgologic.audit.AuditService;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Concilia las ventas con el ERP-Core (CDU-07, ADR-0003). Cada ventana agrupa las órdenes con
 * factura aceptada que todavía no pertenecen a ningún lote, genera el archivo CSV/XML que el
 * AS/400 sabe leer y lo deja disponible.
 *
 * <p>La idempotencia no depende de este código: {@code integration.erp_batch_order} tiene la
 * orden como llave primaria, así que la base misma impide que una venta entre en dos lotes.
 * Reprocesar una ventana no genera doble registro contable.
 *
 * <p>Una orden que llega tarde —por ejemplo, una factura que la SAT aceptó después de varios
 * reintentos— entra en el lote siguiente en vez de perderse: el criterio es "facturada y sin
 * lote", no "facturada dentro de esta ventana exacta".
 */
@Service
public class ErpBatchService {

    private static final Logger log = LoggerFactory.getLogger(ErpBatchService.class);
    private static final DateTimeFormatter FILE_STAMP =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private final JdbcTemplate jdbc;
    private final ErpFileWriter writer;
    private final AuditService audit;

    @Value("${sgologic.erp.format:CSV}")
    private ErpFileFormat format;

    @Value("${sgologic.erp.output-dir:/app/erp-out}")
    private String outputDir;

    public ErpBatchService(JdbcTemplate jdbc, ErpFileWriter writer, AuditService audit) {
        this.jdbc = jdbc;
        this.writer = writer;
        this.audit = audit;
    }

    /**
     * Genera el lote de la ventana que cierra ahora. Si no hay ventas pendientes, no crea un
     * lote vacío: devuelve vacío y la siguiente ventana lo vuelve a intentar.
     */
    @Transactional
    public Optional<Long> generateBatch() {
        List<ErpSale> sales = pendingSales();
        if (sales.isEmpty()) {
            return Optional.empty();
        }

        OffsetDateTime end = OffsetDateTime.now();
        OffsetDateTime start = lastWindowEnd().orElse(sales.get(0).createdAt());
        if (!end.isAfter(start)) {
            start = end.minusMinutes(1);
        }
        BatchWindow window = new BatchWindow(start, end);
        String fileName = "SGO-VENTAS-" + FILE_STAMP.format(end.toInstant()) + "." + format.extension();

        Long batchId = jdbc.queryForObject(
                """
                insert into integration.erp_batch (window_start, window_end, format_id, file_name)
                values (?, ?, ?, ?)
                returning id
                """,
                Long.class, start, end, format.id(), fileName);

        for (ErpSale sale : sales) {
            jdbc.update("insert into integration.erp_batch_order (order_id, batch_id) values (?, ?)",
                    sale.orderId(), batchId);
        }

        String content = writer.write(format, window, sales);
        boolean written = writeFile(fileName, content);
        if (written) {
            // 2 = DELIVERED: el archivo ya está donde el ERP lo recoge.
            jdbc.update("update integration.erp_batch set status_id = 2, sent_at = now() where id = ?", batchId);
        }

        audit.recordSystem("ERP_LOTE_GENERADO", "erp_batch", batchId, null, null,
                Map.of("archivo", fileName, "ordenes", sales.size(),
                       "monto", sales.stream().map(ErpSale::total).reduce(BigDecimal.ZERO, BigDecimal::add),
                       "entregado", written));
        log.info("lote {} del ERP con {} orden(es): {}", batchId, sales.size(), fileName);
        return Optional.of(batchId);
    }

    /** El contenido del archivo de un lote, reconstruido a partir de sus órdenes. */
    public String content(Long batchId) {
        BatchWindow window = jdbc.queryForObject(
                "select window_start, window_end from integration.erp_batch where id = ?",
                (rs, rowNum) -> new BatchWindow(
                        rs.getObject("window_start", OffsetDateTime.class),
                        rs.getObject("window_end", OffsetDateTime.class)),
                batchId);
        ErpFileFormat batchFormat = ErpFileFormat.fromId(jdbc.queryForObject(
                "select format_id from integration.erp_batch where id = ?", Short.class, batchId));
        return writer.write(batchFormat, window, salesOfBatch(batchId));
    }

    public List<Map<String, Object>> summaries(int limit) {
        return jdbc.queryForList(
                """
                select id, window_start, window_end, format, file_name, status, created_at, sent_at,
                       order_count, total_amount
                from integration.erp_batch_summary
                order by id desc
                limit ?
                """,
                limit);
    }

    public Map<String, Object> summary(Long batchId) {
        List<Map<String, Object>> found = jdbc.queryForList(
                """
                select id, window_start, window_end, format, file_name, status, created_at, sent_at,
                       order_count, total_amount
                from integration.erp_batch_summary
                where id = ?
                """,
                batchId);
        return found.isEmpty() ? null : found.get(0);
    }

    public List<ErpSale> salesOfBatch(Long batchId) {
        return jdbc.query(salesQuery("join integration.erp_batch_order b on b.order_id = o.id where b.batch_id = ?"),
                saleMapper(), batchId);
    }

    /** Las ventas facturadas que todavía no entraron en ningún lote. */
    private List<ErpSale> pendingSales() {
        return jdbc.query(
                salesQuery("left join integration.erp_batch_order b on b.order_id = o.id where b.order_id is null"),
                saleMapper());
    }

    private static String salesQuery(String joinAndFilter) {
        return """
               select o.id, o.created_at, ch.code as channel, c.full_name, c.tax_id, o.total,
                      i.series, i.cui
               from orders.purchase_order o
               join customers.customer c on c.id = o.customer_id
               join config.channel ch on ch.id = o.channel_id
               join invoicing.invoice i on i.order_id = o.id and i.status_id = 3
               """ + joinAndFilter + " order by o.id";
    }

    private static org.springframework.jdbc.core.RowMapper<ErpSale> saleMapper() {
        return (rs, rowNum) -> new ErpSale(
                rs.getLong("id"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("channel"),
                rs.getString("full_name"),
                rs.getString("tax_id"),
                rs.getBigDecimal("total"),
                rs.getString("series"),
                rs.getString("cui"));
    }

    private Optional<OffsetDateTime> lastWindowEnd() {
        List<OffsetDateTime> found = jdbc.queryForList(
                "select window_end from integration.erp_batch order by window_end desc limit 1",
                OffsetDateTime.class);
        return found.isEmpty() ? Optional.empty() : Optional.of(found.get(0));
    }

    /** Cuánto lleva la última ventana cerrada, para saber si ya toca generar otra. */
    public Optional<OffsetDateTime> lastBatchAt() {
        return lastWindowEnd();
    }

    private boolean writeFile(String fileName, String content) {
        try {
            Path dir = Path.of(outputDir);
            Files.createDirectories(dir);
            Files.writeString(dir.resolve(fileName), content);
            return true;
        } catch (IOException e) {
            // El lote queda PENDING: existe, es auditable y se reintenta en la siguiente ventana.
            log.error("no se pudo escribir el archivo {} para el ERP: {}", fileName, e.getMessage());
            return false;
        }
    }

    /** La ventana de tiempo que cubre un lote. */
    public record BatchWindow(OffsetDateTime start, OffsetDateTime end) {
    }
}
