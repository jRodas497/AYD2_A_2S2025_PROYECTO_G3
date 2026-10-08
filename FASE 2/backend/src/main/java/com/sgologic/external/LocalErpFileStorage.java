package com.sgologic.external;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

/**
 * Comportamiento de siempre: escribe el archivo del ERP al filesystem local. Entra en juego
 * salvo que exista R2_BUCKET (local, docker-compose y CI no la definen).
 */
@Component
@ConditionalOnExpression("'${R2_BUCKET:}'.isEmpty()")
public class LocalErpFileStorage implements ErpFileStorage {

    @Value("${sgologic.erp.output-dir:/app/erp-out}")
    private String outputDir;

    @Override
    public void write(String fileName, String content) throws IOException {
        Path dir = Path.of(outputDir);
        Files.createDirectories(dir);
        Files.writeString(dir.resolve(fileName), content);
    }
}
