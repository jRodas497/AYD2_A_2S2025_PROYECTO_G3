package com.sgologic.auth;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class RoleConverter implements AttributeConverter<Role, Short> {
    @Override
    public Short convertToDatabaseColumn(Role attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public Role convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : Role.fromId(dbData);
    }
}
