package com.sgologic.inventory;

import com.sgologic.common.ReferenceValue;

/** inventory.reservation_status. Ids fijos, ver FASE 2/db/README.md. */
public enum ReservationStatus implements ReferenceValue {
    ACTIVE((short) 1),
    CONFIRMED((short) 2),
    RELEASED((short) 3),
    EXPIRED((short) 4);

    private final short id;

    ReservationStatus(short id) {
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

    public static ReservationStatus fromId(short id) {
        for (ReservationStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("reservation_status id desconocido: " + id);
    }
}
