package com.sgologic.catalog;

import java.math.BigDecimal;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Configurar Catálogo de Productos (CDU expandido de Configuración). */
@Service
public class ProductService {

    private final ProductRepository products;
    private final JdbcTemplate jdbc;

    public ProductService(ProductRepository products, JdbcTemplate jdbc) {
        this.products = products;
        this.jdbc = jdbc;
    }

    @Transactional
    public Product create(String sku, String name, ProductCategory category, BigDecimal price) {
        Product product = new Product();
        product.setSku(sku);
        product.setName(name);
        product.setCategory(category);
        product.setPrice(price);
        product.setActive(true);
        try {
            product = products.saveAndFlush(product);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ya existe un producto con el sku " + sku);
        }

        // Un producto nuevo entra sin existencia a las 34 ubicaciones, en vez de quedar
        // ausente de inventory.stock (eso lo dejaría fuera de la vista de disponibilidad, RF03).
        jdbc.update(
                """
                insert into inventory.stock (location_id, product_id, on_hand, reserved)
                select id, ?, 0, 0 from inventory.location
                """,
                product.getId());

        return product;
    }

    @Transactional
    public Product update(Long id, String name, ProductCategory category, BigDecimal price, Boolean active) {
        Product product = products.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "producto no encontrado"));
        product.setName(name);
        product.setCategory(category);
        product.setPrice(price);
        if (active != null) {
            product.setActive(active);
        }
        return products.save(product);
    }
}
