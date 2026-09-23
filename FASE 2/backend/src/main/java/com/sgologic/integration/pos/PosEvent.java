package com.sgologic.integration.pos;

import com.sgologic.common.DeliveryStatus;
import java.time.OffsetDateTime;

/** Un evento encolado hacia el POS de una tienda. */
public record PosEvent(
        Long id,
        Long storeId,
        String storeCode,
        String eventType,
        String payload,
        DeliveryStatus status,
        int attempts,
        String lastError,
        OffsetDateTime createdAt,
        OffsetDateTime deliveredAt) {
}
