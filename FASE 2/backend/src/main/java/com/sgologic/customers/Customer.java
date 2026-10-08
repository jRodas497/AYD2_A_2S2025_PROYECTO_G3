package com.sgologic.customers;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "customer", schema = "customers")
@Getter
@Setter
@NoArgsConstructor
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String email;

    private String phone;

    @Column(name = "tax_id", nullable = false)
    private String taxId = "CF";

    private String address;

    /** Null para los clientes creados antes de que existiera login de cliente: no pueden
     * autenticarse hasta que registren una contraseña, pero el resto de su historial sigue
     * intacto. */
    @JsonIgnore
    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;
}
