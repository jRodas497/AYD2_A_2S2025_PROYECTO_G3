package com.sgologic.invoicing;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class InvoiceStatusConverter implements AttributeConverter<InvoiceStatus, Short> {
    @Override
    public Short convertToDatabaseColumn(InvoiceStatus attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public InvoiceStatus convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : InvoiceStatus.fromId(dbData);
    }
}
