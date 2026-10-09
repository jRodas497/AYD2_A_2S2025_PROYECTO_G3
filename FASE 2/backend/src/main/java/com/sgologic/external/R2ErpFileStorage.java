package com.sgologic.external;

import java.io.IOException;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Sube el archivo del ERP a un bucket de Cloudflare R2 (API compatible con S3) en vez de
 * escribirlo al filesystem local — necesario porque el filesystem de un servicio en Render no
 * persiste entre despliegues. Entra en juego solo si R2_BUCKET está definida.
 */
@Component
@ConditionalOnProperty(name = "R2_BUCKET")
public class R2ErpFileStorage implements ErpFileStorage {

    private final S3Client client;
    private final String bucket;

    public R2ErpFileStorage(
            @Value("${R2_ACCOUNT_ID}") String accountId,
            @Value("${R2_ACCESS_KEY_ID}") String accessKeyId,
            @Value("${R2_SECRET_ACCESS_KEY}") String secretAccessKey,
            @Value("${R2_BUCKET}") String bucket) {
        this.bucket = bucket;
        this.client = S3Client.builder()
                .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                // R2 no tiene regiones reales; "auto" es lo que documenta Cloudflare para el SDK de S3.
                .region(Region.of("auto"))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                .forcePathStyle(true)
                .build();
    }

    @Override
    public void write(String fileName, String content) throws IOException {
        try {
            client.putObject(
                    PutObjectRequest.builder().bucket(bucket).key(fileName).build(),
                    RequestBody.fromString(content, java.nio.charset.StandardCharsets.UTF_8));
        } catch (S3Exception e) {
            throw new IOException(e.getMessage(), e);
        }
    }
}
