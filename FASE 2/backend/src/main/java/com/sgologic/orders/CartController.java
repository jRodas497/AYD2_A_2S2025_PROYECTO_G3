package com.sgologic.orders;

import com.sgologic.common.Channel;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Carrito unificado (RF01): el mismo carrito sin importar el canal desde el que se toque. */
@RestController
@RequestMapping("/api/customers/{customerId}/cart")
public class CartController {

    private final CartService cartService;

    public CartController(CartService cartService) {
        this.cartService = cartService;
    }

    @GetMapping
    public CartView get(@PathVariable Long customerId) {
        return cartService.findActiveCart(customerId)
                .map(cart -> CartView.of(cart, cartService.items(cart.getId())))
                .orElse(CartView.empty());
    }

    @PostMapping("/items")
    public CartView addItem(@PathVariable Long customerId, @Valid @RequestBody AddItem body) {
        Channel channel = body.channel() == null ? Channel.WEB : body.channel();
        cartService.addItem(customerId, channel, body.productId(), body.quantity());
        Cart cart = cartService.getOrCreateActiveCart(customerId, channel);
        return CartView.of(cart, cartService.items(cart.getId()));
    }

    public record AddItem(
            @NotNull Long productId,
            @NotNull @Min(1) Integer quantity,
            Channel channel) {
    }

    public record CartItemView(Long productId, int quantity) {
    }

    public record CartView(Long cartId, String status, String channel, List<CartItemView> items) {
        static CartView of(Cart cart, List<CartItem> items) {
            return new CartView(
                    cart.getId(),
                    cart.getStatus().code(),
                    cart.getLastChannel().code(),
                    items.stream().map(i -> new CartItemView(i.getId().getProduct(), i.getQuantity())).toList());
        }

        static CartView empty() {
            return new CartView(null, null, null, List.of());
        }
    }
}
