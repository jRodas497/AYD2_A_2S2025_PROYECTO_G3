package com.sgologic.external;

/**
 * Cómo se comporta un tercero durante la demo. Existe porque PayKlik, la SAT, LogiExpress,
 * el proveedor de mensajería y el POS no están disponibles para conectarse de verdad, y los
 * escenarios de calidad que hay que demostrar son justamente los de falla.
 */
public enum SimulationMode {
    /** Responde bien y rápido. */
    NORMAL,
    /** Tarda más que el umbral configurado: el resultado es un timeout. */
    SLOW,
    /** No responde: se cae la llamada y entra el circuit breaker. */
    DOWN,
    /** Responde, pero rechazando (tarjeta sin fondos, factura mal formada, etc.). */
    REJECT
}
