package com.sgologic.orders;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "order_item", schema = "orders")
@Getter
@Setter
@NoArgsConstructor
@AttributeOverrides({
        @AttributeOverride(name = "order", column = @Column(name = "order_id")),
        @AttributeOverride(name = "product", column = @Column(name = "product_id"))
})
public class OrderItem {

    @EmbeddedId
    private OrderItemId id;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false)
    private BigDecimal unitPrice;

    public OrderItem(Long orderId, Long productId, Integer quantity, BigDecimal unitPrice) {
        this.id = new OrderItemId(orderId, productId);
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }
}
