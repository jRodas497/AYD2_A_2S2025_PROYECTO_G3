package com.sgologic.invoicing;

import com.sgologic.common.ReferenceValue;

/** invoicing.invoice_status. Ids fijos, ver FASE 2/db/README.md. */
public enum InvoiceStatus implements ReferenceValue {
    GENERATED((short) 1),
    SENT((short) 2),
    ACCEPTED((short) 3),
    REJECTED((short) 4);

    private final short id;

    InvoiceStatus(short id) {
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

    public static InvoiceStatus fromId(short id) {
        for (InvoiceStatus s : values()) {
            if (s.id == id) {
                return s;
            }
        }
        throw new IllegalArgumentException("invoice_status id desconocido: " + id);
    }
}
