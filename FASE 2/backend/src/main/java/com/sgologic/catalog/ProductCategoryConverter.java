package com.sgologic.catalog;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter
public class ProductCategoryConverter implements AttributeConverter<ProductCategory, Short> {
    @Override
    public Short convertToDatabaseColumn(ProductCategory attribute) {
        return attribute == null ? null : attribute.id();
    }

    @Override
    public ProductCategory convertToEntityAttribute(Short dbData) {
        return dbData == null ? null : ProductCategory.fromId(dbData);
    }
}
