package com.sgologic.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class IncidentTypeConverter implements AttributeConverter<IncidentType, Short> {
    @Override
    public Short convertToDatabaseColumn(IncidentType attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public IncidentType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : IncidentType.fromId(dbData);
    }
}
