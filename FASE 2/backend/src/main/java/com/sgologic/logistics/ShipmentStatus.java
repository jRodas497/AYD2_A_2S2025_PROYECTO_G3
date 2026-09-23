package com.sgologic.logistics;

import com.sgologic.common.ReferenceValue;

/** logistics.shipment_status. Ids fijos, ver FASE 2/db/README.md. */
public enum ShipmentStatus implements ReferenceValue {
    ASSIGNED((short) 1),
    GUIDE_REQUESTED((short) 2),
    GUIDE_ISSUED((short) 3),
    IN_TRANSIT((short) 4),
    DELIVERED((short) 5),
    FAILED((short) 6);

    private final short id;

    ShipmentStatus(short id) {
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

    public static ShipmentStatus fromId(short id) {
        for (ShipmentStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("shipment_status id desconocido: " + id);
    }
}
