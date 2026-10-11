package com.sgologic.external;

import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Control de la simulación de terceros, para poder demostrar los escenarios de calidad en vivo:
 * poner PayKlik en DOWN y ver que la orden no se pierde, la SAT en REJECT y ver que la orden no
 * se despacha, LogiExpress en DOWN y ver que queda una alerta para Logística.
 *
 * <p>No es un endpoint de negocio. En un despliegue real este controlador no existe.
 */
@RestController
@RequestMapping("/api/simulation")
public class SimulationController {

    private final ProviderHttp http;

    public SimulationController(ProviderHttp http) {
        this.http = http;
    }

    @GetMapping
    public Map<String, String> modes() {
        Map<String, String> result = new java.util.LinkedHashMap<>();
        for (Provider provider : Provider.values()) {
            try {
                Map<?, ?> health = http.request(provider, "/health", "GET", null, null, 1500, Map.class);
                result.put(provider.name(), String.valueOf(health.get("mode")));
            } catch (ProviderUnavailableException e) { result.put(provider.name(), "OFFLINE"); }
        }
        return result;
    }

    @PutMapping("/{provider}")
    public Map<String, String> setMode(@PathVariable String provider, @RequestBody ModeRequest body) {
        Provider target = parse(Provider.class, provider, "proveedor");
        SimulationMode mode = parse(SimulationMode.class, body.mode(), "modo");
        http.request(target, "/admin/mode", "PUT", null, Map.of("mode", mode.name()), 2000, Map.class);
        return modes();
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String value, String what) {
        try {
            return Enum.valueOf(type, String.valueOf(value).trim().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    what + " desconocido: " + value + " (valores: "
                            + String.join(", ", java.util.Arrays.stream(type.getEnumConstants())
                                    .map(Enum::name).toList())
                            + ")");
        }
    }

    public record ModeRequest(String mode) {
    }
}
