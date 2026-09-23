package com.sgologic.inventory;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** RF04: libera automáticamente las unidades reservadas si la compra no se concreta a tiempo. */
@Component
public class ReservationExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(ReservationExpiryJob.class);

    private final InventoryReservationService reservations;

    public ReservationExpiryJob(InventoryReservationService reservations) {
        this.reservations = reservations;
    }

    @Scheduled(fixedDelayString = "${sgologic.reservation.release-expired-fixed-delay-ms}")
    public void releaseExpiredReservations() {
        int released = reservations.releaseExpired();
        if (released > 0) {
            log.info("se liberaron {} reserva(s) vencida(s)", released);
        }
    }
}
