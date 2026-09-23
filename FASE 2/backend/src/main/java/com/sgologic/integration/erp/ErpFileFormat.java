package com.sgologic.integration.erp;

import com.sgologic.common.ReferenceValue;

/** integration.file_format. Los dos formatos que el ERP-Core AS/400 sabe leer. */
public enum ErpFileFormat implements ReferenceValue {
    CSV((short) 1),
    XML((short) 2);

    private final short id;

    ErpFileFormat(short id) {
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

    public String extension() {
        return name().toLowerCase();
    }

    public static ErpFileFormat fromId(short id) {
        for (ErpFileFormat f : values()) {
            if (f.id == id) {
                return f;
            }
        }
        throw new IllegalArgumentException("file_format id desconocido: " + id);
    }
}
