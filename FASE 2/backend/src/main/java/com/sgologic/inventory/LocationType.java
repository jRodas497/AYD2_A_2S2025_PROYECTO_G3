package com.sgologic.inventory;

import com.sgologic.common.ReferenceValue;

/** inventory.location_type. Ids fijos, ver FASE 2/db/README.md. */
public enum LocationType implements ReferenceValue {
    DISTRIBUTION_CENTER((short) 1),
    STORE((short) 2);

    private final short id;

    LocationType(short id) {
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

    public static LocationType fromId(short id) {
        for (LocationType t : values()) {
            if (t.id == id) {
                return t;
            }
        }
        throw new IllegalArgumentException("location_type id desconocido: " + id);
    }
}
