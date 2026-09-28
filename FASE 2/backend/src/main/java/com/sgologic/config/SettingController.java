package com.sgologic.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Configuración del sistema (CDU expandido de Configuración): los parámetros que hoy solo se
 * podían cambiar a mano en {@code config.setting} (por ejemplo, el tiempo de liberación de una
 * reserva de PB-007) quedan aquí para el panel de administración.
 */
@RestController
@RequestMapping("/api/settings")
public class SettingController {

    private final SettingRepository settings;

    public SettingController(SettingRepository settings) {
        this.settings = settings;
    }

    @GetMapping
    public List<Setting> list() {
        return settings.findAll(Sort.by("key"));
    }

    /** Solo cambia el valor: la clave y su descripción se cargan por migración, no desde aquí. */
    @PutMapping("/{key}")
    public Setting update(@PathVariable String key, @Valid @RequestBody UpdateSetting body) {
        Setting setting = settings.findById(key)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "parámetro no encontrado: " + key));
        setting.setValue(body.value());
        return settings.save(setting);
    }

    public record UpdateSetting(@NotBlank String value) {
    }
}
