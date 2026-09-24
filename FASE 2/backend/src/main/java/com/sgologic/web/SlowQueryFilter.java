package com.sgologic.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Registra las consultas que se pasan de su meta de tiempo (CDU-06, E2): "una consulta que excede
 * el tiempo objetivo de 5 segundos se considera una violación del EAC y debe registrarse para
 * revisión de capacidad — no es un comportamiento aceptable silencioso".
 *
 * <p>Mide las dos consultas con meta explícita: el estado de la orden (RC01, 5 s) y la evidencia de
 * auditoría y cobros (RC02 y DC-04, 1 s). Si una respuesta se pasa, deja una línea WARN con la
 * ruta y el tiempo, que es lo que revisa quien dimensiona la capacidad.
 */
@Component
public class SlowQueryFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("sgologic.capacidad");

    @Value("${sgologic.slow-query.order-status-ms:5000}")
    private long orderStatusMs;

    @Value("${sgologic.slow-query.audit-ms:1000}")
    private long auditMs;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long elapsedMs = (System.nanoTime() - start) / 1_000_000;
            long goal = goalFor(request.getMethod(), request.getRequestURI());
            if (goal > 0 && elapsedMs > goal) {
                log.warn("consulta sobre su meta: {} {} tardó {} ms (meta {} ms)",
                        request.getMethod(), request.getRequestURI(), elapsedMs, goal);
            }
        }
    }

    private long goalFor(String method, String uri) {
        if (!"GET".equals(method)) {
            return 0;
        }
        if (uri.matches("/api/orders/\\d+")) {
            return orderStatusMs;
        }
        if (uri.matches("/api/orders/\\d+/trace") || uri.startsWith("/api/reports/payments")
                || uri.startsWith("/api/audit") || uri.matches("/api/orders/\\d+/payments")) {
            return auditMs;
        }
        return 0;
    }
}
