package com.sgologic.logistics;

import com.sgologic.common.ReferenceValue;

/** logistics.carrier. Hoy solo LogiExpress, el transportista con contrato vigente (DR-07). */
public enum Carrier implements ReferenceValue {
    LOGIEXPRESS((short) 1), PICKUP((short) 2), MANUAL((short) 3);

    private final short id;

    Carrier(short id) {
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

    public static Carrier fromId(short id) {
        for (Carrier c : values()) {
            if (c.id == id) {
                return c;
            }
        }
        throw new IllegalArgumentException("carrier id desconocido: " + id);
    }
}
