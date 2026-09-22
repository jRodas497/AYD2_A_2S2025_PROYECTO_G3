package com.sgologic.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class CartStatusConverter implements AttributeConverter<CartStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(CartStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public CartStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : CartStatus.fromId(dbData);
    }
}
