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
        try {
            java.math.BigDecimal value=new java.math.BigDecimal(body.value());
            if(value.signum()<=0 || value.compareTo(java.math.BigDecimal.valueOf(1000000))>0) throw new NumberFormatException();
            if(!key.equals("credit.limit") && value.stripTrailingZeros().scale()>0) throw new NumberFormatException();
            if(key.equals("payment.timeout_ms") && value.compareTo(java.math.BigDecimal.valueOf(5000))>0) throw new NumberFormatException();
        } catch(NumberFormatException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"valor positivo requerido; los intervalos deben ser enteros y el timeout no debe superar 5000 ms"); }
        setting.setValue(body.value());
        return settings.save(setting);
    }

    public record UpdateSetting(@NotBlank String value) {
    }
}
