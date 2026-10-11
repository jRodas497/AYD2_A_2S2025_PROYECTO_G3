package com.sgologic.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgologic.web.ApiExceptionHandler;
import java.time.OffsetDateTime;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/** Permisos por rol; solo catálogo, autenticación y disponibilidad son públicos. */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] STAFF = {"ADMIN", "FINANCE", "LOGISTICS", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE"};

    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    private final JwtAuthenticationFilter jwtAuthFilter;
    private final ObjectMapper mapper;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter, ObjectMapper mapper, org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jwtAuthFilter = jwtAuthFilter;
        this.mapper = mapper; this.jdbc=jdbc;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/providers/logiexpress/tracking").permitAll()
                        .requestMatchers("/api/auth/login", "/api/customers/login", "/api/customers/register").permitAll()
                        .requestMatchers(HttpMethod.POST,"/api/customers/password/forgot","/api/customers/password/reset").permitAll()
                        .requestMatchers("/api/customers/*/active").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET,"/api/products/**","/api/products","/api/promotions","/api/inventory/products/*/availability","/api/inventory/locations").permitAll()
                        .requestMatchers("/api/auth/me").hasAnyRole(STAFF)
                        .requestMatchers("/api/simulation/**", "/api/users/**", "/api/users", "/api/settings/**", "/api/settings").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST,"/api/products", "/api/promotions").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,"/api/products/**", "/api/promotions/**").hasRole("ADMIN")
                        .requestMatchers("/api/audit/**", "/api/reports/**", "/api/orders/*/trace", "/api/invoices/**", "/api/integration/erp/**").hasAnyRole("ADMIN", "FINANCE")
                        .requestMatchers(HttpMethod.GET,"/api/integration/**").hasAnyRole("ADMIN", "FINANCE", "LOGISTICS")
                        .requestMatchers("/api/integration/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET,"/api/shipments/**").hasAnyRole(STAFF)
                        .requestMatchers("/api/shipments/**", "/api/orders/*/dispatch").hasAnyRole("ADMIN", "LOGISTICS", "STORE_MANAGER")
                        .requestMatchers(HttpMethod.POST,"/api/orders/*/invoice").hasAnyRole("ADMIN", "FINANCE")
                        .requestMatchers("/api/incidents/**").hasAnyRole("ADMIN", "FINANCE", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.GET,"/api/notifications/**").hasAnyRole(STAFF)
                        .requestMatchers("/api/notifications/**").hasAnyRole("ADMIN", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.GET,"/api/inventory/**").hasAnyRole(STAFF)
                        .requestMatchers("/api/inventory/**").hasAnyRole("ADMIN", "LOGISTICS", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.POST,"/api/customers").hasAnyRole("ADMIN", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.GET,"/api/customers").hasAnyRole("ADMIN", "FINANCE", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.GET,"/api/orders").hasAnyRole(STAFF)
                        .requestMatchers(HttpMethod.GET,"/api/customers/**").hasAnyRole("CUSTOMER", "ADMIN", "FINANCE", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers("/api/customers/**", "/api/customers").hasAnyRole("CUSTOMER", "ADMIN", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers(HttpMethod.GET,"/api/orders/**").hasAnyRole("CUSTOMER", "ADMIN", "FINANCE", "LOGISTICS", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .requestMatchers("/api/orders/**").hasAnyRole("CUSTOMER", "ADMIN", "CALL_CENTER_AGENT", "STORE_MANAGER", "STORE_EMPLOYEE")
                        .anyRequest().denyAll())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, e) ->
                                writeError(response, HttpStatus.UNAUTHORIZED, "hace falta iniciar sesión", request.getRequestURI()))
                        .accessDeniedHandler((request, response, e) ->
                                writeError(response, HttpStatus.FORBIDDEN, "el usuario no tiene permiso para esto", request.getRequestURI())))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new CustomerAccessFilter(jdbc), JwtAuthenticationFilter.class);
        return http.build();
    }

    private void writeError(
            jakarta.servlet.http.HttpServletResponse response, HttpStatus status, String message, String path)
            throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType("application/json;charset=UTF-8");
        var body = new ApiExceptionHandler.ApiError(
                OffsetDateTime.now(), status.value(), status.getReasonPhrase(), message, path);
        mapper.writeValue(response.getWriter(), body);
    }
}
