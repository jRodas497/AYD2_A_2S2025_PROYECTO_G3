package com.sgologic.catalog;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PricingServiceTest {
    private BigDecimal price(String amount, String discount) {
        var jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(anyString(), eq(BigDecimal.class), any(Object.class)))
                .thenReturn(new BigDecimal(discount));
        var product = new Product();
        product.setCategory(ProductCategory.ROPA);
        product.setPrice(new BigDecimal(amount));
        return new PricingService(jdbc).unitPrice(product);
    }

    @Test void applies_decimal_discount_and_rounds_money() {
        assertThat(price("19.99", "15")).isEqualByComparingTo("16.99");
    }

    @Test void retains_a_positive_cent_for_tiny_discounted_products() {
        assertThat(price("0.01", "99.99")).isEqualByComparingTo("0.01");
    }

    @Test void preserves_undiscounted_price() {
        assertThat(price("50.00", "0")).isEqualByComparingTo("50.00");
    }
}
