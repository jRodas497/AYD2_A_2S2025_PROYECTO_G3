package com.sgologic.auth;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_role", schema = "config")
@Getter
@Setter
@NoArgsConstructor
@AttributeOverrides({
        @AttributeOverride(name = "user", column = @Column(name = "user_id")),
        @AttributeOverride(name = "role", column = @Column(name = "role_id"))
})
public class UserRole {

    @EmbeddedId
    private UserRoleId id;

    public UserRole(Long userId, Role role) {
        this.id = new UserRoleId(userId, role.id());
    }
}
