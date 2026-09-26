package com.sgologic.auth;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Autenticar Usuario (CDU expandido de Configuración).
 *
 * <p>El intento fallido se guarda en su propia transacción corta, separada de la que decide si
 * el login pasa o no. Si las dos compartieran una sola transacción @Transactional, lanzar el 401
 * después de guardar el intento fallido haría que Spring revierta también ese guardado — se
 * probó y pasaba exactamente eso: el contador nunca subía de 0.
 */
@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_MINUTES = 15;

    private final AppUserRepository users;
    private final UserRoleRepository userRoles;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final TransactionTemplate tx;

    public AuthService(
            AppUserRepository users,
            UserRoleRepository userRoles,
            PasswordEncoder encoder,
            JwtService jwt,
            TransactionTemplate tx) {
        this.users = users;
        this.userRoles = userRoles;
        this.encoder = encoder;
        this.jwt = jwt;
        this.tx = tx;
    }

    public LoginResult login(String username, String rawPassword) {
        AppUser user = users.findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "usuario o contraseña incorrectos"));

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "usuario deshabilitado");
        }
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(OffsetDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "demasiados intentos fallidos, intente de nuevo más tarde");
        }

        if (!encoder.matches(rawPassword, user.getPasswordHash())) {
            registerFailedAttempt(user.getId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "usuario o contraseña incorrectos");
        }

        List<String> roles = tx.execute(status -> {
            AppUser fresh = users.findById(user.getId()).orElseThrow();
            fresh.setFailedAttempts(0);
            fresh.setLockedUntil(null);
            fresh.setLastLoginAt(OffsetDateTime.now());
            users.save(fresh);
            return userRoles.findById_User(fresh.getId()).stream()
                    .map(ur -> Role.fromId(ur.getId().getRole()).code())
                    .toList();
        });

        return new LoginResult(jwt.issue(user.getUsername(), roles), user.getUsername(), roles);
    }

    private void registerFailedAttempt(Long userId) {
        tx.executeWithoutResult(status -> {
            AppUser fresh = users.findById(userId).orElseThrow();
            fresh.setFailedAttempts(fresh.getFailedAttempts() + 1);
            if (fresh.getFailedAttempts() >= MAX_FAILED_ATTEMPTS) {
                fresh.setLockedUntil(OffsetDateTime.now().plusMinutes(LOCK_MINUTES));
                fresh.setFailedAttempts(0);
            }
            users.save(fresh);
        });
    }

    public record LoginResult(String token, String username, List<String> roles) {
    }
}
