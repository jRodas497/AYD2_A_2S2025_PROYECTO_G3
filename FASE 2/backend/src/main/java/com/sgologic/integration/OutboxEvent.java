package com.sgologic.integration;

import java.time.OffsetDateTime;
import java.util.Map;

/** Una fila de integration.outbox ya lista para procesar. */
public record OutboxEvent(
        Long id,
        String aggregateType,
        Long aggregateId,
        String eventType,
        Map<String, Object> payload,
        int attempts,
        OffsetDateTime createdAt) {

    public Long longValue(String key) {
        Object value = payload.get(key);
        return value == null ? null : Long.valueOf(value.toString());
    }

    public String stringValue(String key) {
        Object value = payload.get(key);
        return value == null ? null : value.toString();
    }
}
