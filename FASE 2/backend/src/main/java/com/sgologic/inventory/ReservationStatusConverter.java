package com.sgologic.inventory;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ReservationStatusConverter implements AttributeConverter<ReservationStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(ReservationStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public ReservationStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ReservationStatus.fromId(dbData);
    }
}
