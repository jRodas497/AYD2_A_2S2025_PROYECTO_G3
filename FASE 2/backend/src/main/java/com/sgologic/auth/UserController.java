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
@org.springframework.transaction.annotation.Transactional
public class UserController {

    private final AppUserRepository users;
    private final UserRoleRepository userRoles;
    private final PasswordEncoder encoder;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.audit.AuditService audit;

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
        validateStore(body.storeId());
        AppUser user = new AppUser();
        user.setUsername(body.username());
        user.setFullName(body.fullName());
        user.setEmail(body.email());
        user.setPasswordHash(encoder.encode(body.password()));
        user.setStoreId(body.storeId());
        user = users.save(user);
        replaceRoles(user.getId(), body.roles());
        auditUser("USUARIO_CREADO", user);
        return view(user);
    }

    @PutMapping("/{id}/roles")
    public UserView updateRoles(@PathVariable Long id, @Valid @RequestBody UpdateRoles body) {
        lockAdministration();
        AppUser user = load(id);
        protectLastAdministrator(user, body.roles().contains(Role.ADMIN) && user.isActive());
        replaceRoles(id, body.roles());
        auditUser("USUARIO_ROLES_ACTUALIZADOS", user);
        return view(user);
    }

    @PutMapping("/{id}/active")
    public UserView setActive(@PathVariable Long id, @Valid @RequestBody UpdateActive body) {
        lockAdministration();
        AppUser user = load(id);
        protectLastAdministrator(user, body.active());
        if (user.isActive() && !body.active()) user.setAuthVersion(user.getAuthVersion() + 1);
        user.setActive(body.active());
        auditUser(body.active() ? "USUARIO_ACTIVADO" : "USUARIO_DESHABILITADO", user);
        return view(users.save(user));
    }

    @PutMapping("/{id}")
    public UserView update(@PathVariable Long id, @Valid @RequestBody UpdateUser body) {
        lockAdministration();
        AppUser user = load(id);
        protectLastAdministrator(user, body.roles().contains(Role.ADMIN) && user.isActive());
        validateStore(body.storeId());
        replaceRoles(id, body.roles());
        user.setFullName(body.fullName()); user.setEmail(body.email()); user.setStoreId(body.storeId());
        auditUser("USUARIO_ACTUALIZADO", user);
        return view(users.save(user));
    }

    @PutMapping("/{id}/password")
    public UserView resetPassword(@PathVariable Long id, @Valid @RequestBody Password body) {
        lockAdministration();
        AppUser user = load(id);
        user.setPasswordHash(encoder.encode(body.password()));
        user.setAuthVersion(user.getAuthVersion() + 1);
        user.setFailedAttempts(0); user.setLockedUntil(null);
        auditUser("USUARIO_CONTRASENA_RESTABLECIDA", user);
        return view(users.save(user));
    }

    private void auditUser(String action, AppUser user) {
        String actor = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        audit.record(actor, action, "app_user", user.getId(), null, null,
                java.util.Map.of("username", user.getUsername(), "active", user.isActive(), "roles", view(user).roles()));
    }

    private void lockAdministration() {
        jdbc.execute("select pg_advisory_xact_lock(70002)");
    }

    private void protectLastAdministrator(AppUser user, boolean remainsActiveAdmin) {
        boolean wasAdmin = user.isActive() && userRoles.findById_User(user.getId()).stream()
                .anyMatch(ur -> Role.fromId(ur.getId().getRole()) == Role.ADMIN);
        if (wasAdmin && !remainsActiveAdmin && jdbc.queryForObject("select count(*) from config.app_user u join config.user_role r on r.user_id=u.id join config.role role on role.id=r.role_id where u.active and role.code='ADMIN'", Integer.class) <= 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "debe permanecer al menos un administrador activo");
        }
    }

    private void validateStore(Long id) {
        if (id != null && jdbc.queryForObject("select count(*) from inventory.location where id=? and type_id=2", Integer.class, id) == 0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "la ubicación debe ser una tienda válida");
    }

    private void replaceRoles(Long userId, List<Role> roles) {
        userRoles.deleteAll(userRoles.findById_User(userId));
        userRoles.flush();
        for (Role role : new java.util.LinkedHashSet<>(roles)) {
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
            @NotBlank @jakarta.validation.constraints.Size(min=8,max=72) String password,
            Long storeId,
            @NotEmpty List<@NotNull Role> roles) {
    }

    public record UpdateUser(@NotBlank String fullName, @Email String email, Long storeId, @NotEmpty List<@NotNull Role> roles) {}
    public record Password(@NotBlank @jakarta.validation.constraints.Size(min=8,max=72) String password) {}

    public record UpdateRoles(@NotEmpty List<@NotNull Role> roles) {
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
