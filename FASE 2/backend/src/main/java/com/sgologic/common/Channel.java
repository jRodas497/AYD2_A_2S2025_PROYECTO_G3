package com.sgologic.common;

/** config.channel. Ids fijos, ver FASE 2/db/README.md. */
public enum Channel implements ReferenceValue {
    WEB((short) 1),
    MOBILE((short) 2),
    CALL_CENTER((short) 3);

    private final short id;

    Channel(short id) {
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

    public static Channel fromId(short id) {
        for (Channel c : values()) {
            if (c.id == id) {
                return c;
            }
        }
        throw new IllegalArgumentException("channel id desconocido: " + id);
    }
}
