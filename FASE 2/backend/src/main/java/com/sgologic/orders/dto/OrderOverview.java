package com.sgologic.orders.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** Espejo de la vista orders.order_overview (ver FASE 2/db/README.md). */
public record OrderOverview(
        Long orderId,
        OffsetDateTime createdAt,
        Long customerId,
        String customer,
        String channel,
        String status,
        BigDecimal total,
        String lastPaymentResult,
        Integer paymentAttempts,
        String invoiceStatus,
        String shipmentStatus,
        String trackingNumber,
        String deliveryAddress,
        java.util.List<java.util.Map<String,Object>> items,
        String paymentPreference) {
}
