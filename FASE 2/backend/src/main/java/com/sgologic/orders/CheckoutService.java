package com.sgologic.orders;

import com.sgologic.catalog.Product;
import com.sgologic.catalog.ProductRepository;
import com.sgologic.config.SettingsService;
import com.sgologic.inventory.InventoryReservationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Orquesta el checkout (RF01, RF04): valida el carrito, reserva stock artículo por artículo
 * y crea la orden. Si algún artículo no tiene existencia, toda la operación se revierte —
 * no se deja una orden a medio reservar.
 */
@Service
public class CheckoutService {

    private final CartRepository carts;
    private final CartItemRepository cartItems;
    private final ProductRepository products;
    private final PurchaseOrderRepository orders;
    private final OrderItemRepository orderItems;
    private final InventoryReservationService reservations;
    private final SettingsService settings;

    public CheckoutService(
            CartRepository carts,
            CartItemRepository cartItems,
            ProductRepository products,
            PurchaseOrderRepository orders,
            OrderItemRepository orderItems,
            InventoryReservationService reservations,
            SettingsService settings) {
        this.carts = carts;
        this.cartItems = cartItems;
        this.products = products;
        this.orders = orders;
        this.orderItems = orderItems;
        this.reservations = reservations;
        this.settings = settings;
    }

    @Transactional
    public PurchaseOrder checkout(Long customerId, String deliveryAddress) {
        Cart cart = carts.findByCustomerIdAndStatusIn(customerId, List.of(CartStatus.OPEN, CartStatus.IN_CHECKOUT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "el cliente no tiene un carrito activo"));

        List<CartItem> items = cartItems.findById_Cart(cart.getId());
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "el carrito está vacío");
        }

        BigDecimal total = BigDecimal.ZERO;
        for (CartItem item : items) {
            Product product = products.findById(item.getId().getProduct())
                    .filter(Product::isActive)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT, "el producto " + item.getId().getProduct() + " ya no está disponible"));
            total = total.add(product.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())));
        }

        PurchaseOrder order = new PurchaseOrder();
        order.setCartId(cart.getId());
        order.setCustomerId(customerId);
        order.setChannel(cart.getLastChannel());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotal(total);
        order.setDeliveryAddress(deliveryAddress);
        order = orders.save(order);

        int ttlMinutes = settings.reservationTtlMinutes();
        for (CartItem item : items) {
            Product product = products.findById(item.getId().getProduct()).orElseThrow();
            orderItems.save(new OrderItem(order.getId(), product.getId(), item.getQuantity(), product.getPrice()));
            // Si no hay existencia, esto lanza InsufficientStockException y toda la transacción
            // se revierte: no queda una orden a medio reservar.
            reservations.reserve(order.getId(), product.getId(), item.getQuantity(), ttlMinutes);
        }

        cart.setStatus(CartStatus.CONVERTED);
        cart.setUpdatedAt(OffsetDateTime.now());

        return order;
    }
}
