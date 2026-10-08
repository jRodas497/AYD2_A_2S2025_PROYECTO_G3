package com.sgologic.external;

import java.io.IOException;
import org.springframework.stereotype.Component;

/**
 * Adaptador de la carpeta de intercambio con el ERP-Core AS/400 (ADR-0003). El ERP no expone una
 * API: su único mecanismo de recepción es recoger archivos de una ubicación compartida. Dejar el
 * archivo ahí es "entregarlo", y esa ubicación puede no estar disponible (un recurso de red
 * caído, sin espacio, sin permisos) igual que cualquier otro tercero.
 *
 * <p>Dónde queda ese archivo (filesystem local o un bucket de Cloudflare R2) lo decide
 * {@link ErpFileStorage} — ver LocalErpFileStorage y R2ErpFileStorage.
 */
@Component
public class ErpDropClient {

    private final ExternalSimulation simulation;
    private final ErpFileStorage storage;

    public ErpDropClient(ExternalSimulation simulation, ErpFileStorage storage) {
        this.simulation = simulation;
        this.storage = storage;
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
            storage.write(fileName, content);
        } catch (IOException e) {
            throw new ProviderUnavailableException(Provider.ERP, 0, false,
                    "no se pudo escribir " + fileName + " para el AS/400: " + e.getMessage());
        }
    }
}
