package com.sgologic.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class IncidentStatusConverter implements AttributeConverter<IncidentStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(IncidentStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public IncidentStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : IncidentStatus.fromId(dbData);
    }
}
