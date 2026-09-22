package com.sgologic.common;

/** Marca los enums que representan una tabla de referencia (id/code/name) de la base. */
public interface ReferenceValue {
    short id();

    String code();
}
