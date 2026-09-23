package com.sgologic.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * La cola dedicada de avisos del ADR-0004. Corre aparte del flujo de la orden a propósito: si
 * el proveedor de mensajería está caído, lo único que pasa es que estos avisos se quedan
 * pendientes.
 */
@Component
public class NotificationDispatchJob {

    private static final Logger log = LoggerFactory.getLogger(NotificationDispatchJob.class);

    private final NotificationService notifications;

    public NotificationDispatchJob(NotificationService notifications) {
        this.notifications = notifications;
    }

    @Scheduled(fixedDelayString = "${sgologic.notifications.fixed-delay-ms:5000}")
    public void sendPending() {
        int sent = notifications.sendPending();
        if (sent > 0) {
            log.debug("se entregaron {} aviso(s)", sent);
        }
    }
}
