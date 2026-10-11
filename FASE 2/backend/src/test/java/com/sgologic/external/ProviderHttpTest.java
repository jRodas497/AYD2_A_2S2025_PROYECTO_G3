package com.sgologic.external;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import static org.assertj.core.api.Assertions.*;

class ProviderHttpTest {
    @Test void sends_rest_request_with_idempotency_key_and_parses_provider_result() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/execute", exchange -> {
            assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            assertThat(exchange.getRequestHeaders().getFirst("Idempotency-Key")).isEqualTo("order-123");
            assertThat(exchange.getRequestHeaders().getFirst("X-Expected-Provider")).isEqualTo("payklik");
            String body=new String(exchange.getRequestBody().readAllBytes());
            assertThat(body).contains("tok_demo").doesNotContain("cardNumber","cvv");
            byte[] response="{\"approved\":true,\"providerReference\":\"PK-1\",\"latencyMs\":80}".getBytes();
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });
        server.start();
        try {
            var http=new ProviderHttp(new ObjectMapper(),new MockEnvironment().withProperty("sgologic.providers.payklik","http://127.0.0.1:"+server.getAddress().getPort()));
            var response=http.execute(Provider.PAYKLIK,"order-123",Map.of("cardToken","tok_demo"),1000,PayKlikClient.ChargeResponse.class);
            assertThat(response.approved()).isTrue();assertThat(response.providerReference()).isEqualTo("PK-1");
        } finally { server.stop(0); }
    }
    @Test void offline_provider_becomes_a_retryable_network_failure() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        int port=server.getAddress().getPort();server.stop(0);
        var http=new ProviderHttp(new ObjectMapper(),new MockEnvironment().withProperty("sgologic.providers.payklik","http://127.0.0.1:"+port));
        assertThatThrownBy(() -> http.execute(Provider.PAYKLIK,"order-1",Map.of(),200,Map.class)).isInstanceOf(ProviderUnavailableException.class);
    }
    @Test void rejects_a_different_provider_after_a_dns_address_change() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        server.createContext("/execute",exchange -> {
            exchange.getResponseHeaders().add("X-Provider","pos");
            byte[] response="{\"accepted\":true}".getBytes();
            exchange.sendResponseHeaders(200,response.length);exchange.getResponseBody().write(response);exchange.close();
        });
        server.start();
        try {
            var http=new ProviderHttp(new ObjectMapper(),new MockEnvironment().withProperty("sgologic.providers.messaging","http://127.0.0.1:"+server.getAddress().getPort()));
            assertThatThrownBy(() -> http.execute(Provider.MESSAGING,"notice-1",Map.of(),1000,Map.class))
                    .isInstanceOf(ProviderUnavailableException.class).hasMessageContaining("identidad");
        } finally { server.stop(0); }
    }
}
