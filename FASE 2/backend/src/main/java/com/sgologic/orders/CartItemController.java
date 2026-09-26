package com.sgologic.orders;

import com.sgologic.common.Channel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cambiar la cantidad de un producto del carrito o quitarlo (CDU expandido Carrito Omnicanal,
 * "Agregar o Quitar Productos"). Agregar vive en {@link CartController}.
 *
 * <p>El carrito todavía no reserva stock —la reserva se hace al iniciar el checkout, como pide el
 * enunciado—, así que cambiar o quitar un producto aquí no tiene que devolver nada al inventario.
 * La operación que actualiza el carrito y la cantidad es una sola sentencia, sin leer-y-escribir
 * en Java, por la misma razón que el alta usa un upsert: dos canales tocando el mismo carrito a la
 * vez no pueden pisarse.
 */
@RestController
@RequestMapping("/api/customers/{customerId}/cart/items/{productId}")
public class CartItemController {

    private final CartService carts;
    private final CartRepository cartRepository;
    private final JdbcTemplate jdbc;

    public CartItemController(CartService carts, CartRepository cartRepository, JdbcTemplate jdbc) {
        this.carts = carts;
        this.cartRepository = cartRepository;
        this.jdbc = jdbc;
    }

    /** Fija la cantidad exacta de un producto que ya está en el carrito. */
    @PutMapping
    @Transactional
    public CartController.CartView setQuantity(
            @PathVariable Long customerId, @PathVariable Long productId, @Valid @RequestBody SetQuantity body) {
        Cart cart = activeCart(customerId);
        int updated = jdbc.update(
                "update orders.cart_item set quantity = ? where cart_id = ? and product_id = ?",
                body.quantity(), cart.getId(), productId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "el producto " + productId + " no está en el carrito");
        }
        touch(cart, body.channel());
        return view(cart);
    }

    /** Quita un producto del carrito. El carrito sigue existiendo aunque quede vacío. */
    @DeleteMapping
    @Transactional
    public CartController.CartView remove(
            @PathVariable Long customerId, @PathVariable Long productId,
            @RequestParam(required = false) Channel channel) {
        Cart cart = activeCart(customerId);
        int deleted = jdbc.update(
                "delete from orders.cart_item where cart_id = ? and product_id = ?", cart.getId(), productId);
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "el producto " + productId + " no está en el carrito");
        }
        touch(cart, channel);
        return view(cart);
    }

    private Cart activeCart(Long customerId) {
        return carts.findActiveCart(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "el cliente no tiene un carrito activo"));
    }

    /** Registra desde qué canal se tocó el carrito por última vez, igual que al agregar. */
    private void touch(Cart cart, Channel channel) {
        if (channel != null) {
            cart.setLastChannel(channel);
        }
        cart.setUpdatedAt(OffsetDateTime.now());
        cartRepository.save(cart);
    }

    private CartController.CartView view(Cart cart) {
        List<CartItem> items = carts.items(cart.getId());
        return CartController.CartView.of(cart, items);
    }

    public record SetQuantity(@NotNull @Min(1) Integer quantity, Channel channel) {
    }
}
