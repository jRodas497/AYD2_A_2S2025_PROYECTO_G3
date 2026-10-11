package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class PayKlikClient {
    private final ProviderHttp http;
    public PayKlikClient(ProviderHttp http) { this.http = http; }
    public ChargeResponse charge(Long orderId, BigDecimal amount, String cardToken, long timeoutMs) { return http.execute(Provider.PAYKLIK, "charge-" + orderId + (orderId < 0 ? "" : "-" + cardToken), Map.of("orderId", orderId, "amount", amount, "cardToken", cardToken), timeoutMs, ChargeResponse.class); }
    public record ChargeResponse(boolean approved, String providerReference, String failureReason, long latencyMs) {}
}
