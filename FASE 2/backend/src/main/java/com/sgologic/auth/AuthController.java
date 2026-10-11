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
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/login")
    public AuthService.LoginResult login(@Valid @RequestBody LoginRequest body) {
        return auth.login(body.username(), body.password());
    }

    @org.springframework.web.bind.annotation.GetMapping("/me")
    public java.util.Map<String,Object> me(org.springframework.security.core.Authentication authentication) {
        var result=new java.util.LinkedHashMap<String,Object>();
        result.put("username",authentication.getName());
        result.put("roles",authentication.getAuthorities().stream().map(a -> a.getAuthority().replaceFirst("^ROLE_", "")).toList());
        var stores=jdbc.queryForList("select u.store_id,l.code as store_code from config.app_user u left join inventory.location l on l.id=u.store_id where u.username=?",authentication.getName());
        if(!stores.isEmpty()) { result.put("storeId",stores.get(0).get("store_id"));result.put("storeCode",stores.get(0).get("store_code")); }
        return result;
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }
}
