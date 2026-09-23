package com.sgologic.integration.erp;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Arma el archivo que consume el ERP-Core (AS/400). El ERP no se modifica (DR-04): su único
 * mecanismo de recepción son estos archivos, así que el formato se adapta a él y no al revés.
 *
 * <p>El CSV va separado por punto y coma porque los nombres de cliente y de empresa llevan comas
 * ("MegaStore, S.A."), y un separador que aparece dentro del dato es la forma más común de que
 * un sistema legado parta mal una línea.
 */
@Component
public class ErpFileWriter {

    public String write(ErpFileFormat format, ErpBatchService.BatchWindow window, List<ErpSale> sales) {
        return format == ErpFileFormat.XML ? xml(window, sales) : csv(sales);
    }

    private String csv(List<ErpSale> sales) {
        StringBuilder out = new StringBuilder(256);
        out.append("orden;fecha;canal;cliente;nit;total;serie;autorizacion\n");
        for (ErpSale sale : sales) {
            out.append(sale.orderId()).append(';')
                    .append(sale.createdAt()).append(';')
                    .append(clean(sale.channel())).append(';')
                    .append(clean(sale.customer())).append(';')
                    .append(clean(sale.taxId())).append(';')
                    .append(sale.total()).append(';')
                    .append(clean(sale.invoiceSeries())).append(';')
                    .append(clean(sale.invoiceCui())).append('\n');
        }
        return out.toString();
    }

    private String xml(ErpBatchService.BatchWindow window, List<ErpSale> sales) {
        StringBuilder out = new StringBuilder(512);
        out.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
                .append("<loteVentas desde=\"").append(window.start())
                .append("\" hasta=\"").append(window.end()).append("\">\n");
        for (ErpSale sale : sales) {
            out.append("  <venta orden=\"").append(sale.orderId()).append("\">\n")
                    .append("    <fecha>").append(sale.createdAt()).append("</fecha>\n")
                    .append("    <canal>").append(escape(sale.channel())).append("</canal>\n")
                    .append("    <cliente nit=\"").append(escape(sale.taxId())).append("\">")
                    .append(escape(sale.customer())).append("</cliente>\n")
                    .append("    <total>").append(sale.total()).append("</total>\n")
                    .append("    <factura serie=\"").append(escape(sale.invoiceSeries()))
                    .append("\" autorizacion=\"").append(escape(sale.invoiceCui())).append("\"/>\n")
                    .append("  </venta>\n");
        }
        out.append("</loteVentas>\n");
        return out.toString();
    }

    /** Quita el separador y los saltos de línea del dato, que es lo que rompe un parser simple. */
    private static String clean(String text) {
        return text == null ? "" : text.replace(';', ',').replace('\n', ' ').replace('\r', ' ').trim();
    }

    private static String escape(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
