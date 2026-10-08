package com.sgologic.external;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * ErpDropClient delega el "dónde" en ErpFileStorage (filesystem local o R2) y solo decide el
 * "si": bloquea el envío cuando la simulación del ERP no está en modo NORMAL, igual que los
 * demás terceros simulados.
 */
class ErpDropClientTest {

    @Test
    void deja_el_archivo_con_el_storage_cuando_el_erp_esta_normal() throws IOException {
        ExternalSimulation simulation = mock(ExternalSimulation.class);
        ErpFileStorage storage = mock(ErpFileStorage.class);
        when(simulation.modeOf(Provider.ERP)).thenReturn(SimulationMode.NORMAL);

        new ErpDropClient(simulation, storage).drop("lote.csv", "contenido");

        verify(storage).write(eq("lote.csv"), eq("contenido"));
    }

    @Test
    void no_llama_al_storage_si_el_erp_esta_caido() {
        ExternalSimulation simulation = mock(ExternalSimulation.class);
        ErpFileStorage storage = mock(ErpFileStorage.class);
        when(simulation.modeOf(Provider.ERP)).thenReturn(SimulationMode.DOWN);

        assertThatThrownBy(() -> new ErpDropClient(simulation, storage).drop("lote.csv", "x"))
                .isInstanceOf(ProviderUnavailableException.class);

        verifyNoInteractions(storage);
    }

    @Test
    void convierte_un_fallo_de_escritura_en_proveedor_no_disponible() throws IOException {
        ExternalSimulation simulation = mock(ExternalSimulation.class);
        ErpFileStorage storage = mock(ErpFileStorage.class);
        when(simulation.modeOf(Provider.ERP)).thenReturn(SimulationMode.NORMAL);
        doThrow(new IOException("sin espacio")).when(storage).write(eq("lote.csv"), eq("x"));

        assertThatThrownBy(() -> new ErpDropClient(simulation, storage).drop("lote.csv", "x"))
                .isInstanceOf(ProviderUnavailableException.class)
                .hasMessageContaining("sin espacio");
    }

    @Test
    void local_erp_file_storage_escribe_el_archivo_en_el_directorio_configurado() throws Exception {
        Path tempDir = Files.createTempDirectory("erp-out-test");
        LocalErpFileStorage storage = new LocalErpFileStorage();
        setOutputDir(storage, tempDir.toString());

        storage.write("lote.csv", "orden;fecha\n1;2026-10-08");

        assertThat(Files.readString(tempDir.resolve("lote.csv")))
                .isEqualTo("orden;fecha\n1;2026-10-08");
    }

    private static void setOutputDir(LocalErpFileStorage storage, String value) throws Exception {
        var field = LocalErpFileStorage.class.getDeclaredField("outputDir");
        field.setAccessible(true);
        field.set(storage, value);
    }
}
