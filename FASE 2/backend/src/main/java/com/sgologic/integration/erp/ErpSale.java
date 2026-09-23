package com.sgologic.integration.erp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Una venta conciliada, tal como se le entrega al ERP-Core. */
public record ErpSale(
        Long orderId,
        OffsetDateTime createdAt,
        String channel,
        String customer,
        String taxId,
        BigDecimal total,
        String invoiceSeries,
        String invoiceCui) {
}
