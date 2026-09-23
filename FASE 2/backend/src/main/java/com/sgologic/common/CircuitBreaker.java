package com.sgologic.common;

import java.time.Duration;
import java.time.Instant;

/**
 * Circuit breaker de los ADR-0002 (PayKlik) y ADR-0004 (LogiExpress): tras varias fallas
 * seguidas deja de insistir de forma síncrona y el llamador encola el intento, en vez de
 * quedarse esperando a un proveedor que ya se sabe caído.
 *
 * <p>Estados: CLOSED (pasa todo), OPEN (no pasa nada, durante {@code openDuration}) y
 * HALF_OPEN (deja pasar una sola llamada de prueba; si falla, vuelve a abrir).
 *
 * <p>Es una implementación propia y pequeña a propósito: el MVP necesita el comportamiento
 * y la métrica de estado, no la configuración completa de una librería de resiliencia.
 */
public class CircuitBreaker {

    public enum State {
        CLOSED,
        OPEN,
        HALF_OPEN
    }

    private final String name;
    private final int failureThreshold;
    private final Duration openDuration;

    private int consecutiveFailures;
    private Instant openedAt;

    public CircuitBreaker(String name, int failureThreshold, Duration openDuration) {
        this.name = name;
        this.failureThreshold = failureThreshold;
        this.openDuration = openDuration;
    }

    public String name() {
        return name;
    }

    public synchronized State state() {
        if (openedAt == null) {
            return State.CLOSED;
        }
        return Instant.now().isBefore(openedAt.plus(openDuration)) ? State.OPEN : State.HALF_OPEN;
    }

    /** false cuando el circuito está abierto: el llamador debe encolar en vez de llamar al proveedor. */
    public synchronized boolean allowsRequest() {
        return state() != State.OPEN;
    }

    public synchronized void recordSuccess() {
        consecutiveFailures = 0;
        openedAt = null;
    }

    public synchronized void recordFailure() {
        consecutiveFailures++;
        // Una falla durante la llamada de prueba vuelve a abrir el circuito de inmediato.
        if (consecutiveFailures >= failureThreshold || state() == State.HALF_OPEN) {
            openedAt = Instant.now();
        }
    }

    public synchronized int consecutiveFailures() {
        return consecutiveFailures;
    }
}
