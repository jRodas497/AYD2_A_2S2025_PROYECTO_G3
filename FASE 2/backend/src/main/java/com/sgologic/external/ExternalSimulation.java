package com.sgologic.external;

import jakarta.annotation.PostConstruct;
import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Estado de los terceros simulados. Arranca con lo que diga application.yml y se puede cambiar
 * en caliente desde {@code /api/simulation} para demostrar en vivo los escenarios de falla
 * (caída de PayKlik, rechazo de la SAT, timeout de LogiExpress) sin reiniciar el sistema.
 *
 * <p>Es una pieza de demo, no de negocio: el día que los proveedores existan, se borra esta
 * clase y los {@code *Client} llaman por REST.
 */
@Component
public class ExternalSimulation {

    private static final Logger log = LoggerFactory.getLogger(ExternalSimulation.class);

    private final Map<Provider, SimulationMode> modes = new EnumMap<>(Provider.class);

    @Value("${sgologic.simulation.payklik:NORMAL}")
    private SimulationMode payklik;

    @Value("${sgologic.simulation.sat:NORMAL}")
    private SimulationMode sat;

    @Value("${sgologic.simulation.logiexpress:NORMAL}")
    private SimulationMode logiexpress;

    @Value("${sgologic.simulation.messaging:NORMAL}")
    private SimulationMode messaging;

    @Value("${sgologic.simulation.pos:NORMAL}")
    private SimulationMode pos;

    @Value("${sgologic.simulation.erp:NORMAL}")
    private SimulationMode erp;

    /**
     * Proporción de llamadas que fallan aunque el proveedor esté en NORMAL. LogiExpress tiene
     * ~2% de timeouts documentados (ADR-0004); dejarlo en 0 vuelve la demo determinista.
     */
    @Value("${sgologic.simulation.logiexpress-timeout-rate:0.02}")
    private double logiexpressTimeoutRate;

    @PostConstruct
    void init() {
        modes.put(Provider.PAYKLIK, payklik);
        modes.put(Provider.SAT, sat);
        modes.put(Provider.LOGIEXPRESS, logiexpress);
        modes.put(Provider.MESSAGING, messaging);
        modes.put(Provider.POS, pos);
        modes.put(Provider.ERP, erp);
    }

    public SimulationMode modeOf(Provider provider) {
        return modes.getOrDefault(provider, SimulationMode.NORMAL);
    }

    public void setMode(Provider provider, SimulationMode mode) {
        modes.put(provider, mode);
        log.info("simulación: {} pasa a {}", provider, mode);
    }

    public Map<Provider, SimulationMode> modes() {
        return new EnumMap<>(modes);
    }

    /** Timeout intermitente de LogiExpress, el 2% documentado del proveedor. */
    public boolean rollsIntermittentTimeout(Provider provider) {
        if (provider != Provider.LOGIEXPRESS || logiexpressTimeoutRate <= 0) {
            return false;
        }
        return ThreadLocalRandom.current().nextDouble() < logiexpressTimeoutRate;
    }
}
