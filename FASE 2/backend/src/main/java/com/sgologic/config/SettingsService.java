package com.sgologic.config;

import org.springframework.stereotype.Service;

@Service
public class SettingsService {

    private final SettingRepository settings;

    public SettingsService(SettingRepository settings) {
        this.settings = settings;
    }

    public int reservationTtlMinutes() {
        return intValue("reservation.ttl_minutes", 20);
    }

    /** Latencia de PayKlik a partir de la cual el cobro pasa a la cola de contingencia (ADR-0002). */
    public long paymentTimeoutMs() {
        return intValue("payment.timeout_ms", 5000);
    }

    /** Cada cuántos minutos se genera el archivo para el ERP AS/400 (ADR-0003). */
    public int erpBatchIntervalMinutes() {
        return intValue("erp.batch_interval_minutes", 30);
    }

    private int intValue(String key, int defaultValue) {
        return settings.findById(key).map(s -> Integer.parseInt(s.getValue())).orElse(defaultValue);
    }
}
