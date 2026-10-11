package com.sgologic.external;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** REST boundary: timeouts and network failures are real, outside the commerce process. */
@Component
public class ProviderHttp {
    static {
        // Compose can assign a different IP after stop/start. Resolve service DNS on reconnect.
        java.security.Security.setProperty("networkaddress.cache.ttl", "0");
        java.security.Security.setProperty("networkaddress.cache.negative.ttl", "0");
    }
    private final ObjectMapper json;
    private final Environment env;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
    public ProviderHttp(ObjectMapper json, Environment env) { this.json = json; this.env = env; }

    public <T> T execute(Provider provider, String key, Map<String, Object> body, long timeout, Class<T> type) {
        return request(provider, "/execute", "POST", key, body, timeout, type);
    }

    public <T> T request(Provider provider, String path, String method, String key,
                        Map<String, Object> body, long timeout, Class<T> type) {
        long start = System.currentTimeMillis();
        try {
            String base = env.getProperty("sgologic.providers." + provider.name().toLowerCase(),
                    "http://" + provider.name().toLowerCase() + ":8090");
            var builder = HttpRequest.newBuilder(URI.create(base + path)).timeout(Duration.ofMillis(timeout));
            if (key != null) builder.header("Idempotency-Key", key);
            builder.header("Content-Type", "application/json");
            builder.header("X-Expected-Provider", provider.name().toLowerCase());
            builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            var response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            String identity=response.headers().firstValue("X-Provider").orElse(provider.name());
            if(!identity.equalsIgnoreCase(provider.name())) throw new ProviderUnavailableException(provider,
                    System.currentTimeMillis()-start,false,"identidad de proveedor incorrecta: "+identity);
            if (response.statusCode() >= 400) throw new ProviderUnavailableException(provider,
                    System.currentTimeMillis() - start, response.statusCode() == 504,
                    provider + ": HTTP " + response.statusCode());
            return json.readValue(response.body(), type);
        } catch (ProviderUnavailableException e) { throw e;
        } catch (Exception e) {
            if (e instanceof InterruptedException) Thread.currentThread().interrupt();
            throw new ProviderUnavailableException(provider, System.currentTimeMillis() - start,
                    e instanceof java.net.http.HttpTimeoutException, provider + ": " + e.getClass().getSimpleName());
        }
    }
}
