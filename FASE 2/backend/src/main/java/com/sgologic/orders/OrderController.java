package com.sgologic.orders;

import com.sgologic.orders.dto.OrderOverview;
import com.sgologic.common.Channel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
        var auth=org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if(auth!=null && auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_CUSTOMER"))) {
            if(!body.customerId().equals(Long.valueOf(String.valueOf(auth.getDetails())))) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"cliente ajeno");
        }
        return checkoutService.checkout(body.customerId(), body.deliveryAddress(),body.pickupLocationId(),body.channel(),body.paymentMethod());
    }

    /** RC01: estado de la orden en menos de 5 segundos. */
    @GetMapping("/{id}")
    public OrderOverview get(@PathVariable Long id) {
        return orderQueryService.findOverview(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
    }

    /** Listado/búsqueda de órdenes para el backoffice (PB-042): todos los filtros son opcionales. */
    @GetMapping
    public java.util.List<OrderOverview> search(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "50") int limit) {
        return orderQueryService.search(status, customerId, channel, q, limit);
    }

    public record CheckoutRequest(@NotNull Long customerId, @NotBlank String deliveryAddress, Long pickupLocationId, Channel channel,com.sgologic.payments.PaymentMethod paymentMethod) {
    }
}
