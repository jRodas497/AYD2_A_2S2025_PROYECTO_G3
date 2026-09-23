package com.sgologic.external;

import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adaptador de LogiExpress (CDU-04): pide la guía de rastreo de un envío. Simulado, y con el
 * ~2% de timeouts que el proveedor tiene documentado (ADR-0004), para que el reintento del
 * outbox se ejercite solo durante una demo con volumen.
 */
@Component
public class LogiExpressClient {

    private static final Logger log = LoggerFactory.getLogger(LogiExpressClient.class);

    private final ExternalSimulation simulation;

    @Value("${sgologic.simulation.normal-latency-ms:80}")
    private long normalLatencyMs;

    @Value("${sgologic.simulation.slow-latency-ms:5500}")
    private long slowLatencyMs;

    public LogiExpressClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Solicita la guía de un envío.
     *
     * @throws ProviderUnavailableException si LogiExpress no responde; el despacho no se bloquea,
     *     el intento se encola y, si se agota, queda una alerta para Logística
     */
    public GuideResponse requestGuide(Long shipmentId, String originCode, String deliveryAddress) {
        SimulationMode mode = simulation.modeOf(Provider.LOGIEXPRESS);
        long start = System.currentTimeMillis();

        if (mode == SimulationMode.NORMAL && simulation.rollsIntermittentTimeout(Provider.LOGIEXPRESS)) {
            throw new ProviderUnavailableException(
                    Provider.LOGIEXPRESS, elapsed(start), true, "LogiExpress respondió con timeout");
        }

        switch (mode) {
            case DOWN -> throw new ProviderUnavailableException(
                    Provider.LOGIEXPRESS, elapsed(start), false, "LogiExpress no respondió a la solicitud de guía");
            case SLOW -> {
                sleep(slowLatencyMs);
                throw new ProviderUnavailableException(
                        Provider.LOGIEXPRESS, elapsed(start), true, "LogiExpress respondió con timeout");
            }
            case REJECT -> throw new ProviderUnavailableException(
                    Provider.LOGIEXPRESS, elapsed(start), false,
                    "LogiExpress rechazó la solicitud: dirección de entrega fuera de cobertura");
            default -> {
                sleep(normalLatencyMs);
                log.debug("LogiExpress emitió la guía del envío {} desde {}", shipmentId, originCode);
                return new GuideResponse(trackingNumber(), elapsed(start));
            }
        }
    }

    /** Número de guía del proveedor. Lleva letras a propósito: no es un número largo suelto. */
    private static String trackingNumber() {
        return "LX-" + ThreadLocalRandom.current().nextLong(100_000_000L, 999_999_999L);
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

    public record GuideResponse(String trackingNumber, long latencyMs) {
    }
}
