package com.sgologic.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/**
 * Cubre los estados del circuit breaker que usan PayKlik (ADR-0002) y LogiExpress (ADR-0004):
 * cierre normal, apertura tras el umbral de fallas, degradación controlada mientras está
 * abierto y recuperación a medio camino (HALF_OPEN).
 */
class CircuitBreakerTest {

    @Test
    void permanece_cerrado_mientras_las_fallas_no_alcanzan_el_umbral() {
        CircuitBreaker breaker = new CircuitBreaker("test", 3, Duration.ofSeconds(20));

        breaker.recordFailure();
        breaker.recordFailure();

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(breaker.allowsRequest()).isTrue();
        assertThat(breaker.consecutiveFailures()).isEqualTo(2);
    }

    @Test
    void se_abre_al_alcanzar_el_umbral_de_fallas_consecutivas() {
        CircuitBreaker breaker = new CircuitBreaker("test", 3, Duration.ofSeconds(20));

        breaker.recordFailure();
        breaker.recordFailure();
        breaker.recordFailure();

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
        assertThat(breaker.allowsRequest()).isFalse();
    }

    @Test
    void un_exito_reinicia_el_conteo_de_fallas_y_cierra_el_circuito() {
        CircuitBreaker breaker = new CircuitBreaker("test", 3, Duration.ofSeconds(20));
        breaker.recordFailure();
        breaker.recordFailure();

        breaker.recordSuccess();

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.CLOSED);
        assertThat(breaker.consecutiveFailures()).isZero();
    }

    @Test
    void pasa_a_medio_abierto_despues_de_openDuration_y_permite_una_llamada_de_prueba() throws InterruptedException {
        CircuitBreaker breaker = new CircuitBreaker("test", 1, Duration.ofMillis(30));

        breaker.recordFailure();
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);

        Thread.sleep(50);

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.HALF_OPEN);
        assertThat(breaker.allowsRequest()).isTrue();
    }

    @Test
    void una_falla_en_medio_abierto_vuelve_a_abrir_el_circuito_de_inmediato() throws InterruptedException {
        CircuitBreaker breaker = new CircuitBreaker("test", 1, Duration.ofMillis(30));
        breaker.recordFailure();
        Thread.sleep(50);
        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.HALF_OPEN);

        breaker.recordFailure();

        assertThat(breaker.state()).isEqualTo(CircuitBreaker.State.OPEN);
        assertThat(breaker.allowsRequest()).isFalse();
    }
}
