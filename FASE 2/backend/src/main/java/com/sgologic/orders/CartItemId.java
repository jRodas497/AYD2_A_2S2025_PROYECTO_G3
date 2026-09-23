package com.sgologic.orders;

import java.io.Serializable;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class CartItemId implements Serializable {
    private Long cart;
    private Long product;

    public CartItemId(Long cart, Long product) {
        this.cart = cart;
        this.product = product;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CartItemId that)) {
            return false;
        }
        return Objects.equals(cart, that.cart) && Objects.equals(product, that.product);
    }

    @Override
    public int hashCode() {
        return Objects.hash(cart, product);
    }
}
