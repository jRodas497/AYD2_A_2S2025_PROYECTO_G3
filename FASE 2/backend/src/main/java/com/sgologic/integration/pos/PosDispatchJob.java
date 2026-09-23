package com.sgologic.integration.pos;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Mantiene al día al POS de las 32 tiendas, con tolerancia a que una se quede sin red. */
@Component
public class PosDispatchJob {

    private static final Logger log = LoggerFactory.getLogger(PosDispatchJob.class);

    private final PosEventService events;

    public PosDispatchJob(PosEventService events) {
        this.events = events;
    }

    @Scheduled(fixedDelayString = "${sgologic.pos.fixed-delay-ms:5000}")
    public void deliverPending() {
        int delivered = events.deliverPending();
        if (delivered > 0) {
            log.debug("se entregaron {} evento(s) al POS", delivered);
        }
    }
}
