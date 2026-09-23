package com.sgologic.inventory;

import com.sgologic.common.ReferenceValue;

/** inventory.movement_type. Ids fijos, ver FASE 2/db/README.md. */
public enum MovementType implements ReferenceValue {
    IN((short) 1),
    OUT((short) 2);

    private final short id;

    MovementType(short id) {
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

    public static MovementType fromId(short id) {
        for (MovementType t : values()) {
            if (t.id == id) {
                return t;
            }
        }
        throw new IllegalArgumentException("movement_type id desconocido: " + id);
    }
}
