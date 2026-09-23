package com.sgologic.external;

import java.math.BigDecimal;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adaptador de PayKlik (CDU-02). Hoy simula al proveedor porque no hay un PayKlik real contra
 * el cual integrarse; el día que exista, esta clase es el único archivo que cambia —
 * {@link #charge} pasa a hacer un POST REST y el resto del sistema no se entera.
 *
 * <p>Nunca recibe ni devuelve el número completo de tarjeta ni el CVV (DC-08): el cobro se
 * hace con el token que devuelve el formulario de pago, y de la tarjeta solo viajan los
 * últimos 4 dígitos para poder identificarla en un reclamo.
 */
@Component
public class PayKlikClient {

    private static final Logger log = LoggerFactory.getLogger(PayKlikClient.class);

    private final ExternalSimulation simulation;

    /** Latencia normal del proveedor: ~800 ms según su SLA, comprimida para que la demo no se arrastre. */
    @Value("${sgologic.simulation.normal-latency-ms:80}")
    private long normalLatencyMs;

    /** Lo que tarda el proveedor cuando está degradado. Debe superar payment.timeout_ms. */
    @Value("${sgologic.simulation.slow-latency-ms:5500}")
    private long slowLatencyMs;

    public PayKlikClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Cobra {@code amount} a la orden {@code orderId}.
     *
     * @throws ProviderUnavailableException si PayKlik no responde o tarda más de {@code timeoutMs}
     */
    public ChargeResponse charge(Long orderId, BigDecimal amount, String cardToken, long timeoutMs) {
        SimulationMode mode = simulation.modeOf(Provider.PAYKLIK);
        long start = System.currentTimeMillis();

        switch (mode) {
            case DOWN -> throw new ProviderUnavailableException(
                    Provider.PAYKLIK, elapsed(start), false, "PayKlik no respondió a la solicitud de cobro");
            case SLOW -> {
                sleep(Math.min(slowLatencyMs, timeoutMs + 500));
                throw new ProviderUnavailableException(
                        Provider.PAYKLIK, elapsed(start), true,
                        "PayKlik superó el umbral de " + timeoutMs + " ms");
            }
            case REJECT -> {
                sleep(normalLatencyMs);
                return new ChargeResponse(false, reference(), "fondos insuficientes", elapsed(start));
            }
            default -> {
                sleep(normalLatencyMs);
                log.debug("PayKlik aprobó el cobro de la orden {} por {} (token {})", orderId, amount, cardToken);
                return new ChargeResponse(true, reference(), null, elapsed(start));
            }
        }
    }

    private static String reference() {
        return "PK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
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

    /** Lo que devuelve PayKlik: aprobado o no, su referencia y el motivo si rechazó. */
    public record ChargeResponse(boolean approved, String providerReference, String failureReason, long latencyMs) {
    }
}
