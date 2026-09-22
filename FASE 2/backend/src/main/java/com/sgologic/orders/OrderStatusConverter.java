package com.sgologic.orders;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class OrderStatusConverter implements AttributeConverter<OrderStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(OrderStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public OrderStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : OrderStatus.fromId(dbData);
    }
}
