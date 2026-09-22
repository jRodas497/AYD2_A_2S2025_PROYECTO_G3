package com.sgologic.orders;

import com.sgologic.catalog.Product;
import com.sgologic.catalog.ProductRepository;
import com.sgologic.common.Channel;
import com.sgologic.customers.CustomerRepository;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** RF01: mantiene el carrito entre canales — el mismo carrito, sin importar desde dónde se toque. */
@Service
public class CartService {

    private static final List<CartStatus> ACTIVE_STATUSES = List.of(CartStatus.OPEN, CartStatus.IN_CHECKOUT);

    private final CartRepository carts;
    private final CartItemRepository cartItems;
    private final ProductRepository products;
    private final CustomerRepository customers;
    private final JdbcTemplate jdbc;

    public CartService(
            CartRepository carts,
            CartItemRepository cartItems,
            ProductRepository products,
            CustomerRepository customers,
            JdbcTemplate jdbc) {
        this.carts = carts;
        this.cartItems = cartItems;
        this.products = products;
        this.customers = customers;
        this.jdbc = jdbc;
    }

    private void requireCustomerExists(Long customerId) {
        if (!customers.existsById(customerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "cliente no encontrado");
        }
    }

    /** Solo lectura: no crea carrito ni toca el canal. Para simplemente ver el carrito. */
    public Optional<Cart> findActiveCart(Long customerId) {
        requireCustomerExists(customerId);
        return carts.findByCustomerIdAndStatusIn(customerId, ACTIVE_STATUSES);
    }

    @Transactional
    public Cart getOrCreateActiveCart(Long customerId, Channel channel) {
        requireCustomerExists(customerId);
        Cart cart = carts.findByCustomerIdAndStatusIn(customerId, ACTIVE_STATUSES)
                .orElseGet(() -> {
                    Cart c = new Cart();
                    c.setCustomerId(customerId);
                    c.setLastChannel(channel);
                    c.setStatus(CartStatus.OPEN);
                    return carts.save(c);
                });
        if (cart.getLastChannel() != channel) {
            cart.setLastChannel(channel);
            cart.setUpdatedAt(OffsetDateTime.now());
        }
        return cart;
    }

    public List<CartItem> items(Long cartId) {
        return cartItems.findById_Cart(cartId);
    }

    @Transactional
    public CartItem addItem(Long customerId, Channel channel, Long productId, int quantity) {
        if (quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "la cantidad debe ser mayor a 0");
        }
        Product product = products.findById(productId)
                .filter(Product::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "producto no disponible"));

        Cart cart = getOrCreateActiveCart(customerId, channel);

        // Sumar cantidad con un select-luego-save (leer, sumar en Java, guardar) pierde
        // incrementos cuando dos peticiones del mismo carrito llegan casi al mismo tiempo
        // (se probó: 20 altas concurrentes de 1 unidad terminaron en 5, no en 20). El upsert
        // de abajo hace la suma dentro del propio UPDATE, así que cada petición sube el
        // valor que ya haya en la base en ese instante, no uno leído antes por otra.
        jdbc.update(
                """
                insert into orders.cart_item (cart_id, product_id, quantity)
                values (?, ?, ?)
                on conflict (cart_id, product_id) do update
                    set quantity = cart_item.quantity + excluded.quantity
                """,
                cart.getId(), product.getId(), quantity);

        cart.setUpdatedAt(OffsetDateTime.now());
        return cartItems.findById(new CartItemId(cart.getId(), product.getId())).orElseThrow();
    }
}
