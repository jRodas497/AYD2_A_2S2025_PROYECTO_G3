package com.sgologic.payments;

/**
 * Los métodos que acepta CDU-02. No tiene tabla de referencia en la base: el método no cambia
 * el registro del cobro (la referencia y los últimos 4 dígitos salen igual de PayKlik), así que
 * se guarda en el detalle del registro de auditoría en vez de agregar una columna al modelo.
 */
public enum PaymentMethod {
    CARD,
    TRANSFER,
    WALLET
}
