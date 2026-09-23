package com.sgologic.logistics;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ShipmentStatusConverter implements AttributeConverter<ShipmentStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(ShipmentStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public ShipmentStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ShipmentStatus.fromId(dbData);
    }
}
