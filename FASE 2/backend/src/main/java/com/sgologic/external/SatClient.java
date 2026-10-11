package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class SatClient {
    private final ProviderHttp http;
    public SatClient(ProviderHttp http) { this.http = http; }
    public SatResponse send(String cui, String xml) { return http.execute(Provider.SAT, cui, Map.of("cui", cui, "xml", xml), 5000, SatResponse.class); }
    public record SatResponse(boolean accepted, String message) {}
}
