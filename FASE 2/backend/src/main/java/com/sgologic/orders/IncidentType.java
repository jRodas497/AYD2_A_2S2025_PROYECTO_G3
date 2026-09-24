package com.sgologic.orders;

import com.sgologic.common.ReferenceValue;

/** orders.incident_type. Ids fijos, ver FASE 2/db/README.md. */
public enum IncidentType implements ReferenceValue {
    EXCHANGE((short) 1),
    RETURN((short) 2);

    private final short id;

    IncidentType(short id) {
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

    public static IncidentType fromId(short id) {
        for (IncidentType t : values()) {
            if (t.id == id) {
                return t;
            }
        }
        throw new IllegalArgumentException("incident_type id desconocido: " + id);
    }
}
