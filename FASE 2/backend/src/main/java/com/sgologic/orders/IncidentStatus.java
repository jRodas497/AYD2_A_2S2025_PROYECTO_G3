package com.sgologic.orders;

import com.sgologic.common.ReferenceValue;

/** orders.incident_status. Ids fijos, ver FASE 2/db/README.md. */
public enum IncidentStatus implements ReferenceValue {
    REGISTERED((short) 1),
    IN_PROCESS((short) 2),
    RESOLVED((short) 3),
    REJECTED((short) 4);

    private final short id;

    IncidentStatus(short id) {
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

    /** Una incidencia resuelta o rechazada ya no cambia de estado. */
    public boolean isClosed() {
        return this == RESOLVED || this == REJECTED;
    }

    public static IncidentStatus fromId(short id) {
        for (IncidentStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("incident_status id desconocido: " + id);
    }
}
