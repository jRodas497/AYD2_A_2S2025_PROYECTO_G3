package com.sgologic.orders;

import com.sgologic.catalog.Product;
import com.sgologic.common.Channel;
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

    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    public void requireCustomer(Long id,String email) {
        Boolean owned=jdbc.queryForObject("select exists(select 1 from customers.customer where id=? and email=?)",Boolean.class,id,email);
        if(!Boolean.TRUE.equals(owned)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"cliente ajeno");
    }
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.catalog.PricingService pricing;

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

    private BigDecimal priceOf(Product product) { return pricing == null ? product.getPrice() : pricing.unitPrice(product); }

    @Transactional
    public PurchaseOrder checkout(Long customerId, String deliveryAddress) { return checkout(customerId,deliveryAddress,null); }

    @Transactional
    public PurchaseOrder checkout(Long customerId, String deliveryAddress, Long pickupLocationId) {
        return checkout(customerId,deliveryAddress,pickupLocationId,null);
    }

    @Transactional
    public PurchaseOrder checkout(Long customerId, String deliveryAddress, Long pickupLocationId, Channel channel) {
        return checkout(customerId,deliveryAddress,pickupLocationId,channel,com.sgologic.payments.PaymentMethod.CARD);
    }

    @Transactional
    public PurchaseOrder checkout(Long customerId,String deliveryAddress,Long pickupLocationId,Channel channel,com.sgologic.payments.PaymentMethod paymentMethod) {
        if(pickupLocationId!=null) {
            var locations=jdbc.queryForList("select code,name from inventory.location where id=? and type_id=2 and active for share",pickupLocationId);
            if(locations.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"tienda de retiro inválida");
            deliveryAddress="Retiro en tienda " + locations.get(0).get("code") + ": " + locations.get(0).get("name");
        }
        // Serializes simultaneous checkout requests for the same customer's cart.
        if (jdbc != null) {
            var owners=jdbc.queryForList("select id from customers.customer where id=? and active for update",Long.class,customerId);
            if(owners.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"cliente inactivo o inexistente");
        }
        Cart cart = carts.findByCustomerIdAndStatusIn(customerId, List.of(CartStatus.OPEN, CartStatus.IN_CHECKOUT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "el cliente no tiene un carrito activo"));
        if(channel!=null) cart.setLastChannel(channel);

        List<CartItem> items = cartItems.findById_Cart(cart.getId()).stream().sorted(java.util.Comparator.comparing(i->i.getId().getProduct())).toList();
        if (items.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "el carrito está vacío");
        }

        BigDecimal total = BigDecimal.ZERO;
        for (CartItem item : items) {
            Product product = products.findById(item.getId().getProduct())
                    .filter(Product::isActive)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.CONFLICT, "el producto " + item.getId().getProduct() + " ya no está disponible"));
            total = total.add(priceOf(product).multiply(BigDecimal.valueOf(item.getQuantity())));
        }

        PurchaseOrder order = new PurchaseOrder();
        order.setCartId(cart.getId());
        order.setCustomerId(customerId);
        order.setChannel(cart.getLastChannel());
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotal(total);
        order.setDeliveryAddress(deliveryAddress);
        order.setPickupLocationId(pickupLocationId);
        order.setPaymentPreference(paymentMethod==null?"CARD":paymentMethod.name());
        order = orders.save(order);

        int ttlMinutes = settings.reservationTtlMinutes();
        for (CartItem item : items) {
            Product product = products.findById(item.getId().getProduct()).orElseThrow();
            orderItems.save(new OrderItem(order.getId(), product.getId(), item.getQuantity(), priceOf(product)));
            // Si no hay existencia, esto lanza InsufficientStockException y toda la transacción
            // se revierte: no queda una orden a medio reservar.
            if(pickupLocationId==null) reservations.reserve(order.getId(), product.getId(), item.getQuantity(), ttlMinutes);
            else reservations.reserveAtLocation(order.getId(),product.getId(),item.getQuantity(),ttlMinutes,pickupLocationId);
        }

        cart.setStatus(CartStatus.CONVERTED);
        cart.setUpdatedAt(OffsetDateTime.now());

        return order;
    }
}
