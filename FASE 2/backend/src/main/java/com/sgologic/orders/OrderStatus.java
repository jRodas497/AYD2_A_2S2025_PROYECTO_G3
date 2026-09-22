package com.sgologic.orders;

import com.sgologic.common.ReferenceValue;

/** orders.order_status. Ids fijos, ver FASE 2/db/README.md. */
public enum OrderStatus implements ReferenceValue {
    PENDING_PAYMENT((short) 1),
    PAYMENT_IN_PROGRESS((short) 2),
    PAYMENT_FAILED((short) 3),
    PAID((short) 4),
    INVOICED((short) 5),
    IN_DISPATCH((short) 6),
    DELIVERED((short) 7),
    CANCELLED((short) 8),
    RETURNED((short) 9);

    private final short id;

    OrderStatus(short id) {
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

    public static OrderStatus fromId(short id) {
        for (OrderStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("order_status id desconocido: " + id);
    }
}
