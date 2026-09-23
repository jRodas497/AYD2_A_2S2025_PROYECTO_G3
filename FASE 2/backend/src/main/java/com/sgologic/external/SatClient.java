package com.sgologic.external;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adaptador del servicio de facturación electrónica de la SAT (CDU-03). Recibe el XML ya
 * generado y devuelve la validación del documento. Simulado, igual que {@link PayKlikClient}.
 */
@Component
public class SatClient {

    private static final Logger log = LoggerFactory.getLogger(SatClient.class);

    private final ExternalSimulation simulation;

    @Value("${sgologic.simulation.normal-latency-ms:80}")
    private long normalLatencyMs;

    @Value("${sgologic.simulation.slow-latency-ms:5500}")
    private long slowLatencyMs;

    public SatClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Transmite el XML de la factura a la SAT.
     *
     * @throws ProviderUnavailableException si la SAT no responde dentro de la ventana tolerable
     */
    public SatResponse send(String cui, String xml) {
        SimulationMode mode = simulation.modeOf(Provider.SAT);
        long start = System.currentTimeMillis();

        switch (mode) {
            case DOWN -> throw new ProviderUnavailableException(
                    Provider.SAT, elapsed(start), false, "la SAT no respondió al envío del documento");
            case SLOW -> {
                sleep(slowLatencyMs);
                throw new ProviderUnavailableException(
                        Provider.SAT, elapsed(start), true, "la SAT tardó más de la ventana tolerable");
            }
            case REJECT -> {
                sleep(normalLatencyMs);
                return new SatResponse(false, "documento rechazado: serie no autorizada para el emisor");
            }
            default -> {
                sleep(normalLatencyMs);
                log.debug("la SAT aceptó el documento {} ({} caracteres de XML)", cui, xml.length());
                return new SatResponse(true, "documento aceptado por la SAT, autorización " + cui);
            }
        }
    }

    private static long elapsed(long start) {
        return System.currentTimeMillis() - start;
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    public record SatResponse(boolean accepted, String message) {
    }
}
