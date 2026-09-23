package com.sgologic.orders;

import com.sgologic.orders.dto.OrderOverview;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final CheckoutService checkoutService;
    private final OrderQueryService orderQueryService;

    public OrderController(CheckoutService checkoutService, OrderQueryService orderQueryService) {
        this.checkoutService = checkoutService;
        this.orderQueryService = orderQueryService;
    }

    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public PurchaseOrder checkout(@jakarta.validation.Valid @RequestBody CheckoutRequest body) {
        return checkoutService.checkout(body.customerId(), body.deliveryAddress());
    }

    /** RC01: estado de la orden en menos de 5 segundos. */
    @GetMapping("/{id}")
    public OrderOverview get(@PathVariable Long id) {
        return orderQueryService.findOverview(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
    }

    public record CheckoutRequest(@NotNull Long customerId, @NotBlank String deliveryAddress) {
    }
}
