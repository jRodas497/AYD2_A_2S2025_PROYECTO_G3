package com.sgologic.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = true)
public class ChannelConverter implements AttributeConverter<Channel, Short> {
    @Override
    public Short convertToDatabaseColumn(Channel attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public Channel convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : Channel.fromId(dbData);
    }
}
