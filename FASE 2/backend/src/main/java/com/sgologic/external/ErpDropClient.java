package com.sgologic.external;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Adaptador de la carpeta de intercambio con el ERP-Core AS/400 (ADR-0003). El ERP no expone una
 * API: su único mecanismo de recepción es recoger archivos de una ubicación compartida. Dejar el
 * archivo ahí es "entregarlo", y esa ubicación puede no estar disponible (un recurso de red
 * caído, sin espacio, sin permisos) igual que cualquier otro tercero.
 */
@Component
public class ErpDropClient {

    private final ExternalSimulation simulation;

    @Value("${sgologic.erp.output-dir:/app/erp-out}")
    private String outputDir;

    public ErpDropClient(ExternalSimulation simulation) {
        this.simulation = simulation;
    }

    /**
     * Deja el archivo donde el ERP lo recoge.
     *
     * @throws ProviderUnavailableException si la ubicación de intercambio no está disponible
     */
    public void drop(String fileName, String content) {
        if (simulation.modeOf(Provider.ERP) != SimulationMode.NORMAL) {
            throw new ProviderUnavailableException(Provider.ERP, 0, false,
                    "la carpeta de intercambio con el AS/400 no está disponible");
        }
        try {
            Path dir = Path.of(outputDir);
            Files.createDirectories(dir);
            Files.writeString(dir.resolve(fileName), content);
        } catch (IOException e) {
            throw new ProviderUnavailableException(Provider.ERP, 0, false,
                    "no se pudo escribir " + fileName + " para el AS/400: " + e.getMessage());
        }
    }
}
