package com.sgologic.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.List;
import java.util.Map;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Firma y valida el token de sesión. No hay servidor de sesión ni estado que guardar: todo lo
 * que hace falta para saber quién es y qué puede hacer viaja firmado dentro del propio token.
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final long expirationMinutes;

    public JwtService(
            @Value("${sgologic.auth.jwt-secret}") String secret,
            @Value("${sgologic.auth.jwt-expiration-minutes:480}") long expirationMinutes) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMinutes = expirationMinutes;
    }

    public String issue(String username, List<String> roles) {
        return issue(username, roles, Map.of());
    }

    /** Igual que {@link #issue(String, List)} pero con claims propios además de roles — p.ej.
     * customerId, para no tener que resolver el cliente por correo en cada petición. */
    public String issue(String username, List<String> roles, Map<String, Object> extraClaims) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(username)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(expirationMinutes, ChronoUnit.MINUTES)));
        extraClaims.forEach(builder::claim);
        return builder.signWith(key).compact();
    }

    /** {@code null} si el token no existe, expiró o su firma no coincide. */
    public Claims validate(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }
}
