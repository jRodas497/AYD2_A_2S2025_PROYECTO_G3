package com.sgologic.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    @org.springframework.beans.factory.annotation.Autowired
    private PricingService pricing;
    private final ProductRepository products;
    private final ProductService productService;

    public ProductController(ProductRepository products, ProductService productService) {
        this.products = products;
        this.productService = productService;
    }

    @GetMapping
    public List<Product> list(@org.springframework.web.bind.annotation.RequestParam(defaultValue="false") boolean includeInactive) {
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        boolean admin=auth!=null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        return (includeInactive && admin ? products.findAll() : products.findByActiveTrue()).stream().map(this::priced).toList();
    }

    @GetMapping("/{id}")
    public Product get(@PathVariable Long id) {
        return priced(products.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "producto no encontrado")));
    }

    private Product priced(Product product) {
        BigDecimal price=product.getPrice();
        product.setOriginalPrice(price);
        product.setPrice(pricing.unitPrice(product));
        return product;
    }

    /** Configurar Catálogo de Productos: alta. Deja el producto con existencia 0 en las 34 ubicaciones. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product create(@Valid @RequestBody NewProduct body) {
        return productService.create(body.sku(), body.name(), body.category(), body.price());
    }

    /** Configurar Catálogo de Productos: edición (nombre, categoría, precio, activo/inactivo). */
    @PutMapping("/{id}")
    public Product update(@PathVariable Long id, @Valid @RequestBody UpdateProduct body) {
        return productService.update(id, body.name(), body.category(), body.price(), body.active());
    }

    public record NewProduct(
            @NotBlank String sku,
            @NotBlank String name,
            @NotNull ProductCategory category,
            @NotNull @DecimalMin("0.01") BigDecimal price) {
    }

    public record UpdateProduct(
            @NotBlank String name,
            @NotNull ProductCategory category,
            @NotNull @DecimalMin("0.01") BigDecimal price,
            Boolean active) {
    }
}
