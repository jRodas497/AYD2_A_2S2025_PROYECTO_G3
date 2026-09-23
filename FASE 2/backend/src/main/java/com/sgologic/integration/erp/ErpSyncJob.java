package com.sgologic.integration.erp;

import com.sgologic.config.SettingsService;
import java.time.OffsetDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cierra la ventana de sincronización con el ERP cada {@code erp.batch_interval_minutes}
 * (30 por defecto, el intervalo que el AS/400 puede procesar).
 *
 * <p>El intervalo vive en {@code config.setting}, no en el código, porque el caso dice que es
 * configurable. El job se despierta más seguido que la ventana y compara contra el último lote:
 * así cambiar el valor en la base tiene efecto sin reiniciar nada.
 */
@Component
public class ErpSyncJob {

    private static final Logger log = LoggerFactory.getLogger(ErpSyncJob.class);

    private final ErpBatchService batches;
    private final SettingsService settings;

    public ErpSyncJob(ErpBatchService batches, SettingsService settings) {
        this.batches = batches;
        this.settings = settings;
    }

    @Scheduled(fixedDelayString = "${sgologic.erp.check-fixed-delay-ms:60000}")
    public void closeWindowIfDue() {
        OffsetDateTime due = OffsetDateTime.now().minusMinutes(settings.erpBatchIntervalMinutes());
        boolean isDue = batches.lastBatchAt().map(last -> last.isBefore(due)).orElse(true);
        if (!isDue) {
            return;
        }
        batches.generateBatch().ifPresent(id -> log.info("ventana cerrada, lote {} listo para el ERP", id));
    }
}
