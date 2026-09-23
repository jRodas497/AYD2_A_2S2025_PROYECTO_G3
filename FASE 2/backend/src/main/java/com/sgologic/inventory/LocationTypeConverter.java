package com.sgologic.inventory;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class LocationTypeConverter implements AttributeConverter<LocationType, Short> {
    @Override
    public Short convertToDatabaseColumn(LocationType attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public LocationType convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : LocationType.fromId(dbData);
    }
}
