package com.sgologic.auth;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Si viene un token válido en "Authorization: Bearer ...", deja al usuario autenticado para el
 * resto de la petición. Si no viene o no es válido, no hace nada: deja que la regla de acceso de
 * cada endpoint decida (la mayoría son públicos; solo catálogo e incidencias piden estar logueado).
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwt;

    public JwtAuthenticationFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            Claims claims = jwt.validate(header.substring(7));
            if (claims != null) {
                @SuppressWarnings("unchecked")
                List<String> roles = claims.get("roles", List.class);
                List<GrantedAuthority> authorities = roles == null
                        ? List.of()
                        : roles.stream().map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
                SecurityContextHolder.getContext()
                        .setAuthentication(new UsernamePasswordAuthenticationToken(claims.getSubject(), null, authorities));
            }
        }
        chain.doFilter(request, response);
    }
}
