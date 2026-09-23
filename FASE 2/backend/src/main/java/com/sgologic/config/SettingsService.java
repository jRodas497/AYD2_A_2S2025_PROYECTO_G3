package com.sgologic.config;

import org.springframework.stereotype.Service;

@Service
public class SettingsService {

    private final SettingRepository settings;

    public SettingsService(SettingRepository settings) {
        this.settings = settings;
    }

    public int reservationTtlMinutes() {
        return intValue("reservation.ttl_minutes", 15);
    }

    private int intValue(String key, int defaultValue) {
        return settings.findById(key).map(s -> Integer.parseInt(s.getValue())).orElse(defaultValue);
    }
}
