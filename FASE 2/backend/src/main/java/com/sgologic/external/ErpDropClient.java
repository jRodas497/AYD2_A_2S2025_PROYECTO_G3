package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class ErpDropClient {
    private final ProviderHttp http;
    public ErpDropClient(ProviderHttp http) { this.http = http; }
    public void drop(String fileName, String content) { http.execute(Provider.ERP, fileName, Map.of("fileName", fileName, "content", content), 5000, Map.class); }

}
