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
 * Traduce DATABASE_URL (lo que da un Postgres administrado como Neon o el propio de Render:
 * postgresql://usuario:clave@host:puerto/base?parametros) a spring.datasource.*, porque el
 * driver de PostgreSQL JDBC no acepta usuario y clave dentro de la URL (solo host, puerto, base
 * y parámetros de conexión).
 *
 * <p>Solo entra en juego si DATABASE_URL está presente. En local y en docker-compose no se
 * define, así que application.yml sigue resolviendo el datasource con DB_HOST/DB_APP_USER/etc.
 * como siempre. Esa presencia o ausencia es el único interruptor entre "local" y "la base en la
 * nube" — no hay otra variable que elegir entre las dos.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final Logger log = LoggerFactory.getLogger(DatabaseUrlEnvironmentPostProcessor.class);
    private static final int PUERTO_POSTGRES_POR_DEFECTO = 5432;

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.isBlank()) {
            return;
        }

        try {
            URI uri = new URI(databaseUrl);
            String[] credenciales = uri.getUserInfo().split(":", 2);
            // Neon no pone el puerto en la URL (siempre es el 5432); Render sí lo pone, pero por
            // las dudas se cubren los dos. sslmode y channel_binding (Neon los exige) viajan en
            // la query string, así que se preservan tal cual en vez de reconstruir la URL sin ellos.
            int puerto = uri.getPort() == -1 ? PUERTO_POSTGRES_POR_DEFECTO : uri.getPort();
            String query = uri.getRawQuery();
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + puerto + uri.getPath()
                    + (query != null && !query.isBlank() ? "?" + query : "");

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
