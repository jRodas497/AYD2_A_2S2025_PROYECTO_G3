package com.sgologic.orders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sgologic.catalog.Product;
import com.sgologic.catalog.ProductRepository;
import com.sgologic.common.Channel;
import com.sgologic.config.SettingsService;
import com.sgologic.inventory.InventoryReservationService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

/**
 * RF01/RF04: el checkout valida el carrito, calcula el total contra el precio vigente y reserva
 * cada artículo. Si algo falla a medio camino (producto inactivo, carrito vacío), no debe quedar
 * una orden a medio crear.
 */
class CheckoutServiceTest {

    private CartRepository carts;
    private CartItemRepository cartItems;
    private ProductRepository products;
    private PurchaseOrderRepository orders;
    private OrderItemRepository orderItems;
    private InventoryReservationService reservations;
    private SettingsService settings;
    private CheckoutService checkout;

    @BeforeEach
    void setUp() {
        carts = mock(CartRepository.class);
        cartItems = mock(CartItemRepository.class);
        products = mock(ProductRepository.class);
        orders = mock(PurchaseOrderRepository.class);
        orderItems = mock(OrderItemRepository.class);
        reservations = mock(InventoryReservationService.class);
        settings = mock(SettingsService.class);
        checkout = new CheckoutService(carts, cartItems, products, orders, orderItems, reservations, settings);

        when(settings.reservationTtlMinutes()).thenReturn(20);
        when(orders.save(any(PurchaseOrder.class))).thenAnswer(inv -> {
            PurchaseOrder order = inv.getArgument(0);
            order.setId(500L);
            return order;
        });
    }

    private Cart openCart(Long customerId) {
        Cart cart = new Cart();
        cart.setId(1L);
        cart.setCustomerId(customerId);
        cart.setLastChannel(Channel.WEB);
        cart.setStatus(CartStatus.OPEN);
        return cart;
    }

    private Product activeProduct(Long id, String price) {
        Product product = new Product();
        product.setId(id);
        product.setActive(true);
        product.setPrice(new BigDecimal(price));
        return product;
    }

    @Test
    void calcula_el_total_con_el_precio_vigente_y_reserva_cada_articulo() {
        Cart cart = openCart(10L);
        when(carts.findByCustomerIdAndStatusIn(eq(10L), any())).thenReturn(Optional.of(cart));

        CartItem item1 = new CartItem(cart.getId(), 100L, 2);
        CartItem item2 = new CartItem(cart.getId(), 200L, 1);
        when(cartItems.findById_Cart(cart.getId())).thenReturn(List.of(item1, item2));

        when(products.findById(100L)).thenReturn(Optional.of(activeProduct(100L, "50.00")));
        when(products.findById(200L)).thenReturn(Optional.of(activeProduct(200L, "30.00")));

        PurchaseOrder order = checkout.checkout(10L, "Zona 1, Ciudad de Guatemala");

        // 2 x 50.00 + 1 x 30.00 = 130.00
        assertThat(order.getTotal()).isEqualByComparingTo("130.00");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(order.getCustomerId()).isEqualTo(10L);

        verify(reservations).reserve(order.getId(), 100L, 2, 20);
        verify(reservations).reserve(order.getId(), 200L, 1, 20);
    }

    @Test
    void rechaza_el_checkout_si_el_cliente_no_tiene_un_carrito_activo() {
        when(carts.findByCustomerIdAndStatusIn(eq(99L), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> checkout.checkout(99L, "dirección"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no tiene un carrito activo");

        verify(orders, never()).save(any());
    }

    @Test
    void rechaza_el_checkout_si_el_carrito_esta_vacio() {
        Cart cart = openCart(11L);
        when(carts.findByCustomerIdAndStatusIn(eq(11L), any())).thenReturn(Optional.of(cart));
        when(cartItems.findById_Cart(cart.getId())).thenReturn(List.of());

        assertThatThrownBy(() -> checkout.checkout(11L, "dirección"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("carrito está vacío");

        verify(orders, never()).save(any());
    }

    @Test
    void rechaza_el_checkout_si_un_producto_ya_no_esta_disponible() {
        Cart cart = openCart(12L);
        when(carts.findByCustomerIdAndStatusIn(eq(12L), any())).thenReturn(Optional.of(cart));

        CartItem item = new CartItem(cart.getId(), 300L, 1);
        when(cartItems.findById_Cart(cart.getId())).thenReturn(List.of(item));

        Product inactive = activeProduct(300L, "10.00");
        inactive.setActive(false);
        when(products.findById(300L)).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> checkout.checkout(12L, "dirección"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ya no está disponible");

        verify(orders, never()).save(any());
        verify(reservations, never()).reserve(anyLong(), anyLong(), anyInt(), anyInt());
    }

    private static <T> T eq(T value) {
        return org.mockito.ArgumentMatchers.eq(value);
    }
}
