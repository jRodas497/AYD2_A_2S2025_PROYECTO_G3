package com.sgologic.external;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Adaptador del POS local de las tiendas. El POS no se modifica (DR-05): SGO-Logic solo le
 * empuja eventos de actualización, con reintentos y tolerancia a que la red de la tienda
 * esté caída.
 */
@Component
public class PosClient {

    private static final Logger log = LoggerFactory.getLogger(PosClient.class);

    private final ExternalSimulation simulation;

    public PosClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Entrega un evento a la instancia del POS de una tienda.
     *
     * @throws ProviderUnavailableException si el POS de esa tienda no responde
     */
    public void deliver(String storeCode, String eventType, String payload) {
        SimulationMode mode = simulation.modeOf(Provider.POS);
        if (mode == SimulationMode.DOWN || mode == SimulationMode.SLOW) {
            throw new ProviderUnavailableException(
                    Provider.POS, 0, mode == SimulationMode.SLOW,
                    "el POS de la tienda " + storeCode + " no respondió");
        }
        if (mode == SimulationMode.REJECT) {
            throw new ProviderUnavailableException(
                    Provider.POS, 0, false, "el POS de la tienda " + storeCode + " rechazó el evento " + eventType);
        }
        log.debug("POS de {} recibió {}: {}", storeCode, eventType, payload);
    }
}
