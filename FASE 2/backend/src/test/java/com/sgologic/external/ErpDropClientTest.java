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
    void transmits_to_independent_erp_adapter() {
        ProviderHttp http=mock(ProviderHttp.class);
        new ErpDropClient(http).drop("lote.csv","contenido");
        verify(http).execute(eq(Provider.ERP),eq("lote.csv"),eq(java.util.Map.of("fileName","lote.csv","content","contenido")),eq(5000L),eq(java.util.Map.class));
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
