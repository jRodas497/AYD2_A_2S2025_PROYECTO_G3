package com.sgologic.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class DeliveryStatusConverter implements AttributeConverter<DeliveryStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(DeliveryStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public DeliveryStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : DeliveryStatus.fromId(dbData);
    }
}
