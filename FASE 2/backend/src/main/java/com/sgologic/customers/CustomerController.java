package com.sgologic.customers;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerRepository customers;

    public CustomerController(CustomerRepository customers) {
        this.customers = customers;
    }

    @GetMapping("/{id}")
    public Customer get(@PathVariable Long id) {
        return customers.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "cliente no encontrado"));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Customer create(@Valid @RequestBody NewCustomer body) {
        Customer c = new Customer();
        c.setFullName(body.fullName());
        c.setEmail(body.email());
        c.setPhone(body.phone());
        c.setAddress(body.address());
        return customers.save(c);
    }

    /** Modificar Datos de Cliente (CDU expandido de Gestionar Clientes). */
    @PutMapping("/{id}")
    public Customer update(@PathVariable Long id, @Valid @RequestBody UpdateCustomer body) {
        Customer c = get(id);
        c.setFullName(body.fullName());
        c.setEmail(body.email());
        c.setPhone(body.phone());
        c.setAddress(body.address());
        return customers.save(c);
    }

    public record NewCustomer(
            @NotBlank String fullName,
            @Email String email,
            String phone,
            String address) {
    }

    public record UpdateCustomer(
            @NotBlank String fullName,
            @Email String email,
            String phone,
            String address) {
    }
}
