package com.sgologic.orders;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "cart_item", schema = "orders")
@Getter
@Setter
@NoArgsConstructor
@AttributeOverrides({
        @AttributeOverride(name = "cart", column = @Column(name = "cart_id")),
        @AttributeOverride(name = "product", column = @Column(name = "product_id"))
})
public class CartItem {

    @EmbeddedId
    private CartItemId id;

    @Column(nullable = false)
    private Integer quantity;

    public CartItem(Long cartId, Long productId, Integer quantity) {
        this.id = new CartItemId(cartId, productId);
        this.quantity = quantity;
    }
}
