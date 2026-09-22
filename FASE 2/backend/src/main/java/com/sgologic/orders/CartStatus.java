package com.sgologic.orders;

import com.sgologic.common.ReferenceValue;

/** orders.cart_status. Ids fijos, ver FASE 2/db/README.md. */
public enum CartStatus implements ReferenceValue {
    OPEN((short) 1),
    IN_CHECKOUT((short) 2),
    CONVERTED((short) 3),
    ABANDONED((short) 4);

    private final short id;

    CartStatus(short id) {
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

    public static CartStatus fromId(short id) {
        for (CartStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("cart_status id desconocido: " + id);
    }
}
