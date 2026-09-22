package com.sgologic.catalog;

import com.sgologic.common.ReferenceValue;

/** catalog.product_category. Ids fijos, ver FASE 2/db/README.md. */
public enum ProductCategory implements ReferenceValue {
    LINEA_BLANCA((short) 1),
    ELECTRONICA((short) 2),
    ROPA((short) 3),
    CALZADO((short) 4);

    private final short id;

    ProductCategory(short id) {
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

    public static ProductCategory fromId(short id) {
        for (ProductCategory c : values()) {
            if (c.id == id) {
                return c;
            }
        }
        throw new IllegalArgumentException("category id desconocido: " + id);
    }
}
