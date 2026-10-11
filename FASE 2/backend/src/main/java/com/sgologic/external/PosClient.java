package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class PosClient {
    private final ProviderHttp http;
    public PosClient(ProviderHttp http) { this.http = http; }
    public void deliver(String storeCode, String eventType, String payload) { http.execute(Provider.POS, storeCode + ":" + eventType + ":" + Integer.toHexString(payload.hashCode()), Map.of("storeCode", storeCode, "eventType", eventType, "payload", payload), 5000, Map.class); }

}
