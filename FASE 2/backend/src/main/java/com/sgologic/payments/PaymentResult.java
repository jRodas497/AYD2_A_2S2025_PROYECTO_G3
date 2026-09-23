package com.sgologic.payments;

import com.sgologic.common.ReferenceValue;

/** payments.payment_result. Ids fijos, ver FASE 2/db/README.md. */
public enum PaymentResult implements ReferenceValue {
    APPROVED((short) 1),
    DECLINED((short) 2),
    TIMEOUT((short) 3),
    ERROR((short) 4);

    private final short id;

    PaymentResult(short id) {
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

    public static PaymentResult fromId(short id) {
        for (PaymentResult r : values()) {
            if (r.id == id) {
                return r;
            }
        }
        throw new IllegalArgumentException("payment_result id desconocido: " + id);
    }
}
