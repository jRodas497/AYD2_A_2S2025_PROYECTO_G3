package com.sgologic.auth;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AuthService.LoginResult login(@Valid @RequestBody LoginRequest body) {
        return auth.login(body.username(), body.password());
    }

    @org.springframework.web.bind.annotation.GetMapping("/me")
    public java.util.Map<String,Object> me(org.springframework.security.core.Authentication authentication) {
        return java.util.Map.of("username", authentication.getName(), "roles", authentication.getAuthorities().stream()
                .map(a -> a.getAuthority().replaceFirst("^ROLE_", "")).toList());
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }
}
