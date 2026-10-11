package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class LogiExpressClient {
    private final ProviderHttp http;
    public LogiExpressClient(ProviderHttp http) { this.http = http; }
    public GuideResponse requestGuide(Long shipmentId, String originCode, String deliveryAddress) { return http.execute(Provider.LOGIEXPRESS, "guide-" + shipmentId + "-" + originCode, Map.of("shipmentId", shipmentId, "originCode", originCode, "deliveryAddress", deliveryAddress), 5000, GuideResponse.class); }
    public record GuideResponse(String trackingNumber, long latencyMs) {}
}
