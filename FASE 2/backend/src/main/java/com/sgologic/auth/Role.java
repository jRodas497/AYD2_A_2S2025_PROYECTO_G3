package com.sgologic.auth;

import com.sgologic.common.ReferenceValue;

/** config.role. Ids fijos, ver FASE 2/db/README.md. */
public enum Role implements ReferenceValue {
    ADMIN((short) 1),
    STORE_EMPLOYEE((short) 2),
    STORE_MANAGER((short) 3),
    CALL_CENTER_AGENT((short) 4),
    LOGISTICS((short) 5),
    FINANCE((short) 6);

    private final short id;

    Role(short id) {
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

    public static Role fromId(short id) {
        for (Role r : values()) {
            if (r.id == id) {
                return r;
            }
        }
        throw new IllegalArgumentException("role id desconocido: " + id);
    }
}
