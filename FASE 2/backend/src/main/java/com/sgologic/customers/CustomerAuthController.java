package com.sgologic.customers;

import com.sgologic.auth.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Login y registro de cliente de la tienda — distinto del login de personal
 * ({@code AuthController}): aquí el token lleva el rol CUSTOMER y el id del cliente, no el de un
 * usuario del backoffice. Reemplaza el "Cliente invitado" auto-creado por el frontend en cada
 * visita: ahora cada cliente tiene su propia cuenta, con su propio carrito, compras, facturas y
 * crédito, en vez de todo colgado de un registro anónimo compartido por cualquiera que tuviera
 * el id en el navegador.
 */
@RestController
@RequestMapping("/api/customers")
public class CustomerAuthController {

    private final CustomerRepository customers;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public CustomerAuthController(CustomerRepository customers, PasswordEncoder encoder, JwtService jwt) {
        this.customers = customers;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Session register(@Valid @RequestBody RegisterRequest body) {
        if (customers.findByEmail(body.email()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ya existe una cuenta con ese correo");
        }
        Customer c = new Customer();
        c.setFullName(body.fullName());
        c.setEmail(body.email());
        c.setPhone(body.phone());
        c.setAddress(body.address());
        c.setPasswordHash(encoder.encode(body.password()));
        customers.save(c);
        return session(c);
    }

    @PostMapping("/login")
    public Session login(@Valid @RequestBody LoginRequest body) {
        Customer c = customers.findByEmail(body.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "correo o contraseña incorrectos"));
        if (c.getPasswordHash() == null || !encoder.matches(body.password(), c.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "correo o contraseña incorrectos");
        }
        return session(c);
    }

    private Session session(Customer c) {
        String token = jwt.issue(c.getEmail(), List.of("CUSTOMER"), Map.of("customerId", c.getId()));
        return new Session(token, c.getId(), c.getFullName(), c.getEmail(), c.getPhone(), c.getAddress());
    }

    public record RegisterRequest(
            @NotBlank String fullName,
            @NotBlank @Email String email,
            @NotBlank @jakarta.validation.constraints.Size(min=8,max=72) String password,
            String phone,
            String address) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record Session(
            String token, Long customerId, String fullName, String email, String phone, String address) {
    }
}
