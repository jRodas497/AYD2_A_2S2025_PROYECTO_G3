package com.sgologic.external;

import com.sgologic.common.CircuitBreaker;
import java.time.Duration;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Los circuit breakers de los terceros, en un solo lugar para poder consultarlos desde el
 * endpoint de monitoreo: saber si el circuito de PayKlik está abierto es parte de lo que
 * ADR-0002 y ADR-0004 piden vigilar.
 */
@Component
public class CircuitBreakers {

    private final Map<Provider, CircuitBreaker> breakers = new EnumMap<>(Provider.class);

    public CircuitBreakers(
            @Value("${sgologic.circuit.failure-threshold:3}") int failureThreshold,
            @Value("${sgologic.circuit.open-seconds:20}") int openSeconds) {
        Duration open = Duration.ofSeconds(openSeconds);
        for (Provider provider : Provider.values()) {
            breakers.put(provider, new CircuitBreaker(provider.name(), failureThreshold, open));
        }
    }

    public CircuitBreaker of(Provider provider) {
        return breakers.get(provider);
    }

    /** Estado de cada circuito, para el endpoint de salud de las integraciones. */
    public Map<String, String> states() {
        Map<String, String> states = new LinkedHashMap<>();
        breakers.forEach((provider, breaker) -> states.put(provider.name(), breaker.state().name()));
        return states;
    }
}
