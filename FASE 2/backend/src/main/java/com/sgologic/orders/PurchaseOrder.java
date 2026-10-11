package com.sgologic.orders;

import com.sgologic.common.Channel;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "purchase_order", schema = "orders")
@Getter
@Setter
@NoArgsConstructor
public class PurchaseOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cart_id", unique = true)
    private Long cartId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "channel_id", nullable = false)
    private Channel channel;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = OrderStatusConverter.class)
    private OrderStatus status = OrderStatus.PENDING_PAYMENT;

    @Column(nullable = false)
    private BigDecimal total;

    @Column(name = "delivery_address", nullable = false)
    private String deliveryAddress;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();
    @jakarta.persistence.Column(name="pickup_location_id")
    private Long pickupLocationId;
    @Column(name="payment_preference",nullable=false)
    private String paymentPreference="CARD";
}
