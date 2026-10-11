package com.sgologic.catalog;
import java.math.BigDecimal;
import java.math.RoundingMode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
@Service
public class PricingService {
    private final JdbcTemplate jdbc;
    public PricingService(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public BigDecimal unitPrice(Product product) {
        BigDecimal discount=jdbc.queryForObject("select coalesce(max(discount_percent),0) from catalog.promotion where category_id=? and active and starts_at<=now() and ends_at>now()",BigDecimal.class,product.getCategory().id());
        // Cobros, créditos y reembolsos requieren un importe monetario positivo.
        return product.getPrice().multiply(BigDecimal.ONE.subtract(discount.divide(BigDecimal.valueOf(100))))
                .setScale(2,RoundingMode.HALF_UP).max(new BigDecimal("0.01"));
    }
}
