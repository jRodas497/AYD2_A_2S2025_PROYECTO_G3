package com.sgologic.config;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

/**
 * Traduce DATABASE_URL (lo que da un Postgres administrado, como el de Render:
 * postgresql://usuario:clave@host:puerto/base) a spring.datasource.*, porque el driver de
 * PostgreSQL JDBC no acepta usuario y clave dentro de la URL (solo host, puerto y base).
 *
 * <p>Solo entra en juego si DATABASE_URL está presente. En local y en docker-compose no se
 * define, así que application.yml sigue resolviendo el datasource con DB_HOST/DB_APP_USER/etc.
 * como siempre.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final Logger log = LoggerFactory.getLogger(DatabaseUrlEnvironmentPostProcessor.class);

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        try {
            URI uri = new URI(databaseUrl);
            String[] credenciales = uri.getUserInfo().split(":", 2);
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + uri.getPort() + uri.getPath();

            Map<String, Object> propiedades = new LinkedHashMap<>();
            propiedades.put("spring.datasource.url", jdbcUrl);
            propiedades.put("spring.datasource.username", credenciales[0]);
            propiedades.put("spring.datasource.password", credenciales.length > 1 ? credenciales[1] : "");

            environment.getPropertySources().addFirst(new MapPropertySource("databaseUrl", propiedades));
        } catch (Exception e) {
            log.error("DATABASE_URL no se pudo interpretar; se sigue con DB_HOST y los demás", e);
        }
    }
}
