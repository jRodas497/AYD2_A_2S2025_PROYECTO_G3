package com.sgologic.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Gestionar roles y usuarios internos (CDU expandido de Configuración, PB-047): quién puede
 * entrar y qué rol tiene. No incluye a los clientes finales — esos son datos de negocio en
 * {@code customers.customer}, no personal del sistema.
 *
 * <p>Un usuario nunca se borra (V5 solo le dio {@code insert, update} a la app sobre
 * {@code config.app_user}): se desactiva con {@code active = false}, igual que ya documentaba el
 * README de la base antes de que existiera esta pantalla.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final AppUserRepository users;
    private final UserRoleRepository userRoles;
    private final PasswordEncoder encoder;

    public UserController(AppUserRepository users, UserRoleRepository userRoles, PasswordEncoder encoder) {
        this.users = users;
        this.userRoles = userRoles;
        this.encoder = encoder;
    }

    @GetMapping
    public List<UserView> list() {
        return users.findAll().stream().map(this::view).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserView create(@Valid @RequestBody NewUser body) {
        if (users.findByUsername(body.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ya existe un usuario con ese nombre");
        }
        AppUser user = new AppUser();
        user.setUsername(body.username());
        user.setFullName(body.fullName());
        user.setEmail(body.email());
        user.setPasswordHash(encoder.encode(body.password()));
        user.setStoreId(body.storeId());
        user = users.save(user);
        replaceRoles(user.getId(), body.roles());
        return view(user);
    }

    @PutMapping("/{id}/roles")
    public UserView updateRoles(@PathVariable Long id, @Valid @RequestBody UpdateRoles body) {
        AppUser user = load(id);
        replaceRoles(id, body.roles());
        return view(user);
    }

    @PutMapping("/{id}/active")
    public UserView setActive(@PathVariable Long id, @Valid @RequestBody UpdateActive body) {
        AppUser user = load(id);
        user.setActive(body.active());
        return view(users.save(user));
    }

    private void replaceRoles(Long userId, List<Role> roles) {
        userRoles.deleteAll(userRoles.findById_User(userId));
        for (Role role : roles) {
            userRoles.save(new UserRole(userId, role));
        }
    }

    private AppUser load(Long id) {
        return users.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "usuario no encontrado"));
    }

    private UserView view(AppUser user) {
        List<String> roles = userRoles.findById_User(user.getId()).stream()
                .map(ur -> Role.fromId(ur.getId().getRole()).code())
                .toList();
        return new UserView(
                user.getId(), user.getUsername(), user.getFullName(), user.getEmail(), user.isActive(),
                user.getStoreId(), roles, user.getLastLoginAt());
    }

    public record NewUser(
            @NotBlank String username,
            @NotBlank String fullName,
            @Email String email,
            @NotBlank String password,
            Long storeId,
            @NotNull List<Role> roles) {
    }

    public record UpdateRoles(@NotEmpty List<Role> roles) {
    }

    public record UpdateActive(@NotNull Boolean active) {
    }

    /** Nunca incluye passwordHash: es lo que se le muestra al panel de administración. */
    public record UserView(
            Long id,
            String username,
            String fullName,
            String email,
            boolean active,
            Long storeId,
            List<String> roles,
            OffsetDateTime lastLoginAt) {
    }
}
