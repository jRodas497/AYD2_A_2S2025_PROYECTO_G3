package com.sgologic.logistics;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class CarrierConverter implements AttributeConverter<Carrier, Short> {
    @Override
    public Short convertToDatabaseColumn(Carrier attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public Carrier convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : Carrier.fromId(dbData);
    }
}
