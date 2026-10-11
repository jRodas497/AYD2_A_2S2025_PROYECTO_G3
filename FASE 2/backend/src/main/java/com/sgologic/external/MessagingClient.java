package com.sgologic.external;
import java.util.Map;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;
/** External REST adapter; provider state and failures live in an independent container. */
@Component
public class MessagingClient {
    private final ProviderHttp http;
    public MessagingClient(ProviderHttp http) { this.http = http; }
    public String send(String channel, String recipient, String message) { return http.execute(Provider.MESSAGING, channel + ":" + recipient + ":" + Integer.toHexString(message.hashCode()), Map.of("channel", channel, "recipient", recipient, "message", message), 5000, Response.class).rejection(); }
    private record Response(String rejection) {}
}
