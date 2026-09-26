package com.sgologic.audit;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Los reportes que pidió Finanzas: el historial de cobros y el resumen de ventas.
 *
 * <p>Ambos salen de vistas o de consultas agregadas en la base, no de traer las filas al
 * backend para sumarlas en Java: es lo que permite responder rápido cuando hay muchas órdenes.
 */
@RestController
@RequestMapping("/api/reports")
public class ReportingController {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    public ReportingController(JdbcTemplate jdbc, AuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    /**
     * Cada intento de cobro con su orden, canal, fecha y resultado (CDU-02). Sale de la vista
     * {@code payments.payment_audit}, que es la que se definió para esta consulta.
     */
    @GetMapping("/payments")
    public List<Map<String, Object>> payments(
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "100") int limit) {

        StringBuilder sql = new StringBuilder(
                "select attempted_at, order_id, channel, attempt_number, result, amount, "
                        + "provider_reference, card_last4, failure_reason, latency_ms "
                        + "from payments.payment_audit where 1 = 1");
        List<Object> args = new java.util.ArrayList<>();
        if (result != null && !result.isBlank()) {
            sql.append(" and result = ?");
            args.add(result.trim().toUpperCase());
        }
        if (channel != null && !channel.isBlank()) {
            sql.append(" and channel = ?");
            args.add(channel.trim().toUpperCase());
        }
        if (orderId != null) {
            sql.append(" and order_id = ?");
            args.add(orderId);
        }
        if (from != null) {
            sql.append(" and attempted_at >= ?");
            args.add(from);
        }
        if (to != null) {
            sql.append(" and attempted_at <= ?");
            args.add(to);
        }
        sql.append(" order by attempted_at desc limit ?");
        args.add(limit);
        return jdbc.queryForList(sql.toString(), args.toArray());
    }

    /**
     * Informe de ventas conciliado (Auditar y consolidar): cuánto se vendió, por canal y por
     * estado, y cuánto de eso ya está respaldado por una factura aceptada y entregado al ERP.
     * La diferencia entre "facturado" y "entregado al ERP" es exactamente lo que Finanzas tiene
     * que explicar al cerrar, y aquí sale desglosada en vez de investigarse a mano.
     *
     * <p>Cada generación del informe queda en la auditoría, con el periodo y los totales que
     * mostró, para poder reconstruir después qué cifra se presentó y cuándo.
     */
    @GetMapping("/sales")
    public SalesReport sales(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {

        OffsetDateTime since = from == null ? OffsetDateTime.now().minusDays(30) : from;
        OffsetDateTime until = to == null ? OffsetDateTime.now() : to;

        List<Map<String, Object>> byChannel = jdbc.queryForList(
                """
                select ch.code as canal, count(*) as ordenes, coalesce(sum(o.total), 0) as monto
                from orders.purchase_order o
                join config.channel ch on ch.id = o.channel_id
                where o.created_at between ? and ?
                group by ch.code
                order by monto desc
                """,
                since, until);

        List<Map<String, Object>> byStatus = jdbc.queryForList(
                """
                select os.code as estado, count(*) as ordenes, coalesce(sum(o.total), 0) as monto
                from orders.purchase_order o
                join orders.order_status os on os.id = o.status_id
                where o.created_at between ? and ?
                group by os.code
                order by ordenes desc
                """,
                since, until);

        Map<String, Object> totals = jdbc.queryForMap(
                """
                select count(*) as ordenes, coalesce(sum(total), 0) as monto
                from orders.purchase_order
                where created_at between ? and ?
                """,
                since, until);

        Map<String, Object> reconciliation = jdbc.queryForMap(
                """
                select
                    count(i.order_id) as facturadas,
                    coalesce(sum(o.total) filter (where i.order_id is not null), 0) as monto_facturado,
                    count(e.order_id) filter (where b.status_id = 2) as entregadas_al_erp,
                    coalesce(sum(o.total) filter (where b.status_id = 2), 0) as monto_entregado_al_erp,
                    count(e.order_id) filter (where b.status_id = 1) as en_lote_pendiente,
                    count(i.order_id) filter (where e.order_id is null) as facturadas_sin_lote,
                    coalesce(sum(o.total) filter (where i.order_id is not null and e.order_id is null), 0)
                        as monto_sin_lote
                from orders.purchase_order o
                left join invoicing.invoice i on i.order_id = o.id and i.status_id = 3
                left join integration.erp_batch_order e on e.order_id = o.id
                left join integration.erp_batch b on b.id = e.batch_id
                where o.created_at between ? and ?
                """,
                since, until);
        reconciliation.put("cuadra",
                ((Number) reconciliation.get("facturadas")).longValue()
                        == ((Number) reconciliation.get("entregadas_al_erp")).longValue());

        audit.record("api", "REPORTE_VENTAS_GENERADO", "report", "sales", null, null,
                Map.of("desde", since.toString(), "hasta", until.toString(),
                       "ordenes", totals.get("ordenes"), "monto", totals.get("monto"),
                       "facturadas", reconciliation.get("facturadas"),
                       "entregadasAlErp", reconciliation.get("entregadas_al_erp")));

        return new SalesReport(since, until, totals, reconciliation, byChannel, byStatus);
    }

    public record SalesReport(
            OffsetDateTime from,
            OffsetDateTime to,
            Map<String, Object> total,
            Map<String, Object> reconciliation,
            List<Map<String, Object>> byChannel,
            List<Map<String, Object>> byStatus) {
    }
}
