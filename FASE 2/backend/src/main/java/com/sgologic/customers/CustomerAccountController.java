package com.sgologic.customers;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
public class CustomerAccountController {
    private final CustomerAccountService accounts;
    public CustomerAccountController(CustomerAccountService accounts) { this.accounts=accounts; }
    @PostMapping("/password/forgot") @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String,String> forgot(@Valid @RequestBody Forgot body) {
        accounts.forgot(body.email());return Map.of("message","Si existe una cuenta activa, recibirás un enlace de recuperación.");
    }
    @PostMapping("/password/reset")
    public Map<String,String> reset(@Valid @RequestBody Reset body) {
        accounts.reset(body.token(),body.password());return Map.of("message","Contraseña actualizada. Inicia sesión de nuevo.");
    }
    @PutMapping("/{id}/password")
    public Map<String,String> password(@PathVariable Long id,@Valid @RequestBody Change body) {
        accounts.changePassword(id,body.currentPassword(),body.password());return Map.of("message","Contraseña actualizada. Inicia sesión de nuevo.");
    }
    @PutMapping("/{id}/active")
    public Map<String,Object> active(@PathVariable Long id,@Valid @RequestBody Active body) { accounts.active(id,body.active());return Map.of("id",id,"active",body.active()); }
    public record Forgot(@NotBlank @Email String email) {}
    public record Reset(@NotBlank String token,@NotBlank @Size(min=8,max=72) String password) {}
    public record Change(@NotBlank String currentPassword,@NotBlank @Size(min=8,max=72) String password) {}
    public record Active(@NotNull Boolean active) {}
}
