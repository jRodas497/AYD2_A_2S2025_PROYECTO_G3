package com.sgologic.orders;

import com.sgologic.catalog.Product;
import com.sgologic.catalog.ProductRepository;
import com.sgologic.common.Channel;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
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

    public CartService(CartRepository carts, CartItemRepository cartItems, ProductRepository products) {
        this.carts = carts;
        this.cartItems = cartItems;
        this.products = products;
    }

    /** Solo lectura: no crea carrito ni toca el canal. Para simplemente ver el carrito. */
    public java.util.Optional<Cart> findActiveCart(Long customerId) {
        return carts.findByCustomerIdAndStatusIn(customerId, ACTIVE_STATUSES);
    }

    @Transactional
    public Cart getOrCreateActiveCart(Long customerId, Channel channel) {
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
        CartItemId id = new CartItemId(cart.getId(), product.getId());
        CartItem item = cartItems.findById(id).orElseGet(() -> new CartItem(cart.getId(), product.getId(), 0));
        item.setQuantity(item.getQuantity() + quantity);
        cart.setUpdatedAt(OffsetDateTime.now());
        return cartItems.save(item);
    }
}
