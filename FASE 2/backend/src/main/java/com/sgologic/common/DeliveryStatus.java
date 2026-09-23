package com.sgologic.common;

/**
 * config.delivery_status. Lo comparte todo lo que se envía con reintentos: el outbox, los avisos,
 * los eventos del POS y los lotes del ERP. FAILED significa que se agotaron los reintentos.
 * Ids fijos, ver FASE 2/db/README.md.
 */
public enum DeliveryStatus implements ReferenceValue {
    PENDING((short) 1),
    DELIVERED((short) 2),
    FAILED((short) 3);

    private final short id;

    DeliveryStatus(short id) {
        this.id = id;
    }

    @Override
    public short id() {
        return id;
    }

    @Override
    public String code() {
        return name();
    }

    public static DeliveryStatus fromId(short id) {
        for (DeliveryStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("delivery_status id desconocido: " + id);
    }
}
