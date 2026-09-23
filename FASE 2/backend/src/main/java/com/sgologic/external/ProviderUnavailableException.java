package com.sgologic.external;

/**
 * El tercero no respondió: o se cayó la llamada, o tardó más del umbral tolerable.
 * Quien llama decide si encola el intento o degrada; nunca se propaga al cliente final.
 */
public class ProviderUnavailableException extends RuntimeException {

    private final Provider provider;
    private final long latencyMs;
    private final boolean timeout;

    public ProviderUnavailableException(Provider provider, long latencyMs, boolean timeout, String message) {
        super(message);
        this.provider = provider;
        this.latencyMs = latencyMs;
        this.timeout = timeout;
    }

    public Provider provider() {
        return provider;
    }

    public long latencyMs() {
        return latencyMs;
    }

    /** true si fue por latencia (timeout), false si el proveedor no respondió del todo. */
    public boolean isTimeout() {
        return timeout;
    }
}
