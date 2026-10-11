package com.sgologic.integration.erp;

import com.sgologic.audit.AuditService;
import com.sgologic.external.ErpDropClient;
import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.integration.pos.PosEventService;
import java.math.BigDecimal;
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
    private final ErpDropClient drop;
    private final PosEventService posEvents;

    @Value("${sgologic.erp.format:CSV}")
    private ErpFileFormat format;

    public ErpBatchService(
            JdbcTemplate jdbc, ErpFileWriter writer, AuditService audit, ErpDropClient drop, PosEventService posEvents) {
        this.jdbc = jdbc;
        this.writer = writer;
        this.audit = audit;
        this.drop = drop;
        this.posEvents = posEvents;
    }

    /**
     * Genera el lote de la ventana que cierra ahora. Si no hay ventas pendientes, no crea un
     * lote vacío: devuelve vacío y la siguiente ventana lo vuelve a intentar.
     */
    @Transactional
    public Optional<Long> generateBatch() {
        jdbc.execute("select pg_advisory_xact_lock(70001)");
        List<ErpSale> sales = new java.util.ArrayList<>(pendingSales());
        List<ErpSale> returns=returnSales(null);
        sales.addAll(returns);
        if (sales.isEmpty()) {
            return Optional.empty();
        }

        OffsetDateTime end = OffsetDateTime.now();
        OffsetDateTime start = lastWindowEnd().orElse(sales.get(0).createdAt());
        if (!end.isAfter(start)) {
            start = end.minusMinutes(1);
        }
        BatchWindow window = new BatchWindow(start, end);
        String fileName = "SGO-VENTAS-" + FILE_STAMP.format(end.toInstant()) + "-" + java.util.UUID.randomUUID().toString().substring(0, 8) + "." + format.extension();

        Long batchId = jdbc.queryForObject(
                """
                insert into integration.erp_batch (window_start, window_end, format_id, file_name)
                values (?, ?, ?, ?)
                returning id
                """,
                Long.class, start, end, format.id(), fileName);

        for (ErpSale sale : sales) {
            if(sale.orderId()<0) {
                jdbc.update("insert into integration.erp_batch_refund(refund_id,batch_id) values(?,?)",-sale.orderId(),batchId);
                continue;
            }
            jdbc.update("insert into integration.erp_batch_order (order_id, batch_id) values (?, ?)",
                    sale.orderId(), batchId);
        }

        String content = writer.write(format, window, sales);
        jdbc.update("update integration.erp_batch set file_content=? where id=?",content,batchId);
        boolean written = false; // Kafka delivers after the batch transaction commits.

        // Paso 10 del flujo: con la ventana cerrada, las 32 tiendas reciben la existencia actualizada.
        int stores = posEvents.publishConsolidatedInventory(start, end);

        audit.recordSystem("ERP_LOTE_GENERADO", "erp_batch", batchId, null, null,
                Map.of("archivo", fileName, "ordenes", sales.size(),
                       "monto", sales.stream().map(ErpSale::total).reduce(BigDecimal.ZERO, BigDecimal::add),
                       "entregado", written, "tiendasNotificadas", stores));
        log.info("lote {} del ERP con {} orden(es): {}", batchId, sales.size(), fileName);
        return Optional.of(batchId);
    }

    /** El contenido del archivo de un lote, reconstruido a partir de sus órdenes. */
    public String content(Long batchId) {
        String stored=jdbc.queryForObject("select file_content from integration.erp_batch where id=?",String.class,batchId);
        if(stored!=null) return stored;
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
                       order_count, total_amount, attempts, last_error
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
                       order_count, total_amount, attempts, last_error
                from integration.erp_batch_summary
                where id = ?
                """,
                batchId);
        return found.isEmpty() ? null : found.get(0);
    }

    public List<ErpSale> salesOfBatch(Long batchId) {
        var sales=new java.util.ArrayList<>(jdbc.query(salesQuery("join integration.erp_batch_order b on b.order_id = o.id where b.batch_id = ?"),saleMapper(),batchId));
        sales.addAll(returnSales(batchId));
        return sales;
    }

    private List<ErpSale> returnSales(Long batchId) {
        String filter=batchId==null ? "r.status_id=2 and e.refund_id is null" : "e.batch_id=?";
        String sql="select -r.id as id,r.refunded_at as created_at,ch.code as channel,c.full_name,c.tax_id,-r.amount as total,coalesce(i.series,'') as series,coalesce(i.cui,'') as cui from payments.refund r join orders.purchase_order o on o.id=r.order_id join customers.customer c on c.id=o.customer_id join config.channel ch on ch.id=o.channel_id left join invoicing.invoice i on i.order_id=o.id left join integration.erp_batch_refund e on e.refund_id=r.id where " + filter;
        return batchId==null ? jdbc.query(sql,saleMapper()) : jdbc.query(sql,saleMapper(),batchId);
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

    /** Reintento manual de un lote. Devuelve false si sigue sin poder entregarse. */
    @Transactional
    public boolean retry(Long batchId) {
        Map<String, Object> batch = summary(batchId);
        if (batch == null) {
            throw new IllegalArgumentException("lote no encontrado: " + batchId);
        }
        if ("DELIVERED".equals(batch.get("status"))) {
            return true;
        }
        jdbc.update("update integration.erp_batch set status_id=1, attempts=0,last_error=null,kafka_published_at=null, relay_lease_until=null where id=? and status_id=3", batchId);
        return false;
    }

    public void deliverOne(Long batchId) {
        var batch = summary(batchId);
        if (batch == null || !"PENDING".equals(batch.get("status"))) return;
        drop.drop((String) batch.get("file_name"), content(batchId));
        jdbc.update("update integration.erp_batch set status_id=2, sent_at=now(),attempts=attempts+1,last_error=null where id=?", batchId);
    }

    /** La ventana de tiempo que cubre un lote. */
    public record BatchWindow(OffsetDateTime start, OffsetDateTime end) {
    }
}
