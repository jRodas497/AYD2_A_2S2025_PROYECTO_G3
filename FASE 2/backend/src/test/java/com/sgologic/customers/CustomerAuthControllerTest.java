package com.sgologic.customers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sgologic.auth.JwtService;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

/**
 * Login y registro de cliente (reemplaza el "Cliente invitado" anónimo): cada cuenta queda con
 * su propio hash de contraseña y el token lleva el rol CUSTOMER más el customerId, para no
 * resolver el cliente por correo en cada petición siguiente.
 */
class CustomerAuthControllerTest {

    @Test
    void registra_una_cuenta_nueva_y_devuelve_un_token() {
        CustomerRepository customers = mock(CustomerRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        when(customers.findByEmail("nueva@example.com")).thenReturn(Optional.empty());
        when(encoder.encode("secreta123")).thenReturn("hash-simulado");
        when(customers.save(any(Customer.class))).thenAnswer(inv -> {
            Customer c = inv.getArgument(0);
            c.setId(42L);
            return c;
        });
        when(jwt.issue(eq("nueva@example.com"), any(), any())).thenReturn("token-simulado");

        var result = new CustomerAuthController(customers, encoder, jwt).register(
                new CustomerAuthController.RegisterRequest(
                        "Nueva Cliente", "nueva@example.com", "secreta123", "50200000000", "Zona 1"));

        assertThat(result.token()).isEqualTo("token-simulado");
        assertThat(result.customerId()).isEqualTo(42L);
        verify(customers).save(any(Customer.class));
    }

    @Test
    void no_registra_dos_cuentas_con_el_mismo_correo() {
        CustomerRepository customers = mock(CustomerRepository.class);
        when(customers.findByEmail("ya@example.com")).thenReturn(Optional.of(new Customer()));

        var controller = new CustomerAuthController(customers, mock(PasswordEncoder.class), mock(JwtService.class));

        assertThatThrownBy(() -> controller.register(
                new CustomerAuthController.RegisterRequest("X", "ya@example.com", "pass1234", null, null)))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void login_rechaza_contrasena_incorrecta() {
        CustomerRepository customers = mock(CustomerRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        Customer existente = new Customer();
        existente.setEmail("maria@example.com");
        existente.setPasswordHash("hash-real");
        when(customers.findByEmail("maria@example.com")).thenReturn(Optional.of(existente));
        when(encoder.matches("mala", "hash-real")).thenReturn(false);

        var controller = new CustomerAuthController(customers, encoder, mock(JwtService.class));

        assertThatThrownBy(() -> controller.login(
                new CustomerAuthController.LoginRequest("maria@example.com", "mala")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void login_rechaza_una_cuenta_sin_contrasena_registrada() {
        CustomerRepository customers = mock(CustomerRepository.class);
        Customer sinPassword = new Customer();
        sinPassword.setEmail("viejo@example.com");
        when(customers.findByEmail("viejo@example.com")).thenReturn(Optional.of(sinPassword));

        var controller = new CustomerAuthController(customers, mock(PasswordEncoder.class), mock(JwtService.class));

        assertThatThrownBy(() -> controller.login(
                new CustomerAuthController.LoginRequest("viejo@example.com", "cualquiera")))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void login_correcto_devuelve_el_id_y_el_correo_del_cliente() {
        CustomerRepository customers = mock(CustomerRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        Customer existente = new Customer();
        existente.setId(7L);
        existente.setFullName("María López");
        existente.setEmail("maria@example.com");
        existente.setPasswordHash("hash-real");
        when(customers.findByEmail("maria@example.com")).thenReturn(Optional.of(existente));
        when(encoder.matches("cliente123", "hash-real")).thenReturn(true);
        when(jwt.issue(anyString(), any(), any())).thenReturn("token-maria");

        var result = new CustomerAuthController(customers, encoder, jwt).login(
                new CustomerAuthController.LoginRequest("maria@example.com", "cliente123"));

        assertThat(result.customerId()).isEqualTo(7L);
        assertThat(result.email()).isEqualTo("maria@example.com");
        assertThat(result.token()).isEqualTo("token-maria");
    }
}
