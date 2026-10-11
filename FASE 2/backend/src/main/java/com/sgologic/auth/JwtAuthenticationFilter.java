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
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

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
                if (claims.get("customerId") == null && jdbc != null) {
                    var versions = jdbc.queryForList("select auth_version from config.app_user where username=? and active", Integer.class, claims.getSubject());
                    Number claimedVersion = claims.get("authVersion", Number.class);
                    if (versions.isEmpty() || versions.get(0) != (claimedVersion == null ? 0 : claimedVersion.intValue())) {
                        chain.doFilter(request,response); return;
                    }
                    roles = jdbc.queryForList("select r.code from config.app_user u join config.user_role ur on ur.user_id=u.id join config.role r on r.id=ur.role_id where u.username=? and u.active",String.class,claims.getSubject());
                    if (roles.isEmpty()) { chain.doFilter(request,response); return; }
                }
                List<GrantedAuthority> authorities = roles == null
                        ? List.of()
                        : roles.stream().map(r -> (GrantedAuthority) new SimpleGrantedAuthority("ROLE_" + r)).toList();
                var authentication=new UsernamePasswordAuthenticationToken(claims.getSubject(), null, authorities);
                authentication.setDetails(claims.get("customerId"));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        }
        chain.doFilter(request, response);
    }
}
