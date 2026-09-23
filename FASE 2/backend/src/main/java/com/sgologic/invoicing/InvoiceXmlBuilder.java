package com.sgologic.invoicing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Arma el XML de la factura electrónica con el CUI y la serie autorizada (CDU-03).
 *
 * <p>Sigue la forma del documento electrónico de la SAT (GTDocumento/DTE) lo suficiente para que
 * se reconozca como tal, sin pretender ser un certificador acreditado: la firma electrónica y la
 * certificación las hace el proveedor autorizado, que está fuera del alcance del MVP.
 */
@Component
public class InvoiceXmlBuilder {

    private final JdbcTemplate jdbc;

    @Value("${sgologic.invoicing.issuer-name:MegaStore, S.A.}")
    private String issuerName;

    @Value("${sgologic.invoicing.issuer-tax-id:1234567-8}")
    private String issuerTaxId;

    public InvoiceXmlBuilder(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String build(Long orderId, String cui, String series) {
        Header header = jdbc.queryForObject(
                """
                select o.id, o.total, o.created_at, c.full_name, c.tax_id
                from orders.purchase_order o
                join customers.customer c on c.id = o.customer_id
                where o.id = ?
                """,
                (rs, rowNum) -> new Header(
                        rs.getLong("id"),
                        rs.getBigDecimal("total"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getString("full_name"),
                        rs.getString("tax_id")),
                orderId);

        List<Line> lines = jdbc.query(
                """
                select p.sku, p.name, i.quantity, i.unit_price
                from orders.order_item i
                join catalog.product p on p.id = i.product_id
                where i.order_id = ?
                order by p.sku
                """,
                (rs, rowNum) -> new Line(
                        rs.getString("sku"), rs.getString("name"),
                        rs.getInt("quantity"), rs.getBigDecimal("unit_price")),
                orderId);

        StringBuilder xml = new StringBuilder(512);
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<dte:GTDocumento xmlns:dte=\"http://www.sat.gob.gt/dte/fel/0.2.0\" Version=\"0.1\">\n")
                .append("  <dte:SAT ClaseDocumento=\"dte\">\n")
                .append("    <dte:DTE ID=\"DatosCertificados\">\n")
                .append("      <dte:DatosEmision ID=\"DatosEmision\">\n")
                .append("        <dte:DatosGenerales Tipo=\"FACT\" CodigoMoneda=\"GTQ\"")
                .append(" NumeroAutorizacion=\"").append(escape(cui)).append("\"")
                .append(" Serie=\"").append(escape(series)).append("\"")
                .append(" FechaHoraEmision=\"").append(header.createdAt()).append("\"/>\n")
                .append("        <dte:Emisor NITEmisor=\"").append(escape(issuerTaxId)).append("\"")
                .append(" NombreEmisor=\"").append(escape(issuerName)).append("\"/>\n")
                .append("        <dte:Receptor IDReceptor=\"").append(escape(header.taxId())).append("\"")
                .append(" NombreReceptor=\"").append(escape(header.customerName())).append("\"/>\n")
                .append("        <dte:Items>\n");

        int number = 1;
        for (Line line : lines) {
            BigDecimal lineTotal = line.unitPrice().multiply(BigDecimal.valueOf(line.quantity()));
            xml.append("          <dte:Item NumeroLinea=\"").append(number++).append("\">\n")
                    .append("            <dte:Cantidad>").append(line.quantity()).append("</dte:Cantidad>\n")
                    .append("            <dte:Descripcion>").append(escape(line.sku() + " - " + line.name()))
                    .append("</dte:Descripcion>\n")
                    .append("            <dte:PrecioUnitario>").append(line.unitPrice())
                    .append("</dte:PrecioUnitario>\n")
                    .append("            <dte:Total>").append(lineTotal).append("</dte:Total>\n")
                    .append("          </dte:Item>\n");
        }

        xml.append("        </dte:Items>\n")
                .append("        <dte:Totales><dte:GranTotal>").append(header.total())
                .append("</dte:GranTotal></dte:Totales>\n")
                .append("        <dte:Complemento Referencia=\"orden-").append(header.orderId())
                .append("\"/>\n")
                .append("      </dte:DatosEmision>\n")
                .append("    </dte:DTE>\n")
                .append("  </dte:SAT>\n")
                .append("</dte:GTDocumento>\n");
        return xml.toString();
    }

    private static String escape(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }

    private record Header(
            Long orderId, BigDecimal total, OffsetDateTime createdAt, String customerName, String taxId) {
    }

    private record Line(String sku, String name, int quantity, BigDecimal unitPrice) {
    }
}
