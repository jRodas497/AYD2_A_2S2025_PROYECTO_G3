package com.sgologic.notifications;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class NotificationChannelConverter implements AttributeConverter<NotificationChannel, Short> {
    @Override
    public Short convertToDatabaseColumn(NotificationChannel attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public NotificationChannel convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : NotificationChannel.fromId(dbData);
    }
}
