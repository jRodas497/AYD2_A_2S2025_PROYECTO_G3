package com.sgologic.payments;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sgologic.audit.AuditService;
import com.sgologic.common.Channel;
import com.sgologic.common.CircuitBreaker;
import com.sgologic.config.SettingsService;
import com.sgologic.external.CircuitBreakers;
import com.sgologic.external.PayKlikClient;
import com.sgologic.external.Provider;
import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxService;
import com.sgologic.inventory.ReservationLifecycleService;
import com.sgologic.notifications.NotificationService;
import com.sgologic.orders.OrderStatus;
import com.sgologic.orders.PurchaseOrder;
import com.sgologic.orders.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * CDU-02: el cobro debe aprobar, rechazar o quedar "en proceso" según responda PayKlik, sin
 * perder nunca la orden. El circuit breaker real (no un mock) se usa aquí para que las
 * transiciones de estado se ejerciten de verdad, igual que en producción.
 */
class PaymentServiceTest {

    private PurchaseOrderRepository orders;
    private PaymentAttemptRepository attempts;
    private PayKlikClient payklik;
    private CircuitBreakers breakers;
    private ReservationLifecycleService reservations;
    private OutboxService outbox;
    private NotificationService notifications;
    private AuditService audit;
    private SettingsService settings;
    private TransactionTemplate tx;
    private PaymentService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        orders = mock(PurchaseOrderRepository.class);
        attempts = mock(PaymentAttemptRepository.class);
        payklik = mock(PayKlikClient.class);
        breakers = mock(CircuitBreakers.class);
        reservations = mock(ReservationLifecycleService.class);
        outbox = mock(OutboxService.class);
        notifications = mock(NotificationService.class);
        audit = mock(AuditService.class);
        settings = mock(SettingsService.class);
        tx = mock(TransactionTemplate.class);

        // El circuit breaker de PayKlik es una instancia real y cerrada: así se prueba la
        // interacción real de PaymentService con él, no solo que se le haya llamado.
        when(breakers.of(Provider.PAYKLIK)).thenReturn(new CircuitBreaker("PAYKLIK", 3, Duration.ofSeconds(20)));
        when(settings.paymentTimeoutMs()).thenReturn(5000L);

        when(tx.execute(any(TransactionCallback.class))).thenAnswer(inv -> {
            TransactionCallback<?> callback = inv.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        });
        doAnswer(inv -> {
            java.util.function.Consumer<TransactionStatus> action = inv.getArgument(0);
            action.accept(mock(TransactionStatus.class));
            return null;
        }).when(tx).executeWithoutResult(any());

        service = new PaymentService(
                orders, attempts, payklik, breakers, reservations, outbox, notifications, audit, settings, tx);
    }

    private PurchaseOrder pendingOrder(Long id) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(id);
        order.setCustomerId(1L);
        order.setChannel(Channel.WEB);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setTotal(new BigDecimal("100.00"));
        order.setDeliveryAddress("dirección");
        return order;
    }

    @Test
    void un_cobro_aprobado_marca_la_orden_como_pagada_y_publica_el_evento() {
        PurchaseOrder order = pendingOrder(1L);
        when(orders.findByIdForUpdate(1L)).thenReturn(Optional.of(order));
        when(attempts.nextAttemptNumber(1L)).thenReturn(1);
        when(attempts.insert(eq(1L), eq(1), eq(PaymentResult.APPROVED), any(), any(), any(), any(), any()))
                .thenReturn(new PaymentAttempt(
                        10L, 1L, 1, PaymentResult.APPROVED, order.getTotal(), "PK-REF", "1111", null, 80, null));
        when(payklik.charge(eq(1L), any(), any(), anyLong()))
                .thenReturn(new PayKlikClient.ChargeResponse(true, "PK-REF", null, 80));

        PaymentService.PaymentOutcome outcome = service.pay(1L, PaymentMethod.CARD, "tok_abc", "1111");

        assertThat(outcome.result()).isEqualTo("APPROVED");
        assertThat(outcome.orderStatus()).isEqualTo("PAID");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        verify(reservations).confirmForOrder(1L);
        verify(outbox).publishForOrder(eq(1L), eq(EventTypes.ORDER_PAID), any());
    }

    @Test
    void un_cobro_rechazado_deja_la_orden_en_pago_fallido_y_notifica_al_cliente() {
        PurchaseOrder order = pendingOrder(2L);
        when(orders.findByIdForUpdate(2L)).thenReturn(Optional.of(order));
        when(attempts.nextAttemptNumber(2L)).thenReturn(1);
        when(attempts.insert(eq(2L), eq(1), eq(PaymentResult.DECLINED), any(), any(), any(), any(), any()))
                .thenReturn(new PaymentAttempt(
                        11L, 2L, 1, PaymentResult.DECLINED, order.getTotal(), "PK-REF", "0000",
                        "fondos insuficientes", 60, null));
        when(payklik.charge(eq(2L), any(), any(), anyLong()))
                .thenReturn(new PayKlikClient.ChargeResponse(false, "PK-REF", "fondos insuficientes", 60));

        PaymentService.PaymentOutcome outcome = service.pay(2L, PaymentMethod.CARD, "tok_abc", "0000");

        assertThat(outcome.result()).isEqualTo("DECLINED");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAYMENT_FAILED);
        verify(notifications).queueForOrder(eq(2L), org.mockito.ArgumentMatchers.contains("rechazado"));
        verify(reservations, org.mockito.Mockito.never()).confirmForOrder(anyLong());
    }

    @Test
    void rechaza_cobrar_una_orden_que_ya_esta_pagada() {
        PurchaseOrder order = pendingOrder(3L);
        order.setStatus(OrderStatus.PAID);
        when(orders.findByIdForUpdate(3L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.pay(3L, PaymentMethod.CARD, "tok_abc", "1111"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("ya fue pagada");

        verify(payklik, org.mockito.Mockito.never()).charge(any(), any(), any(), anyLong());
    }

    @Test
    void rechaza_cobrar_una_orden_cancelada() {
        PurchaseOrder order = pendingOrder(4L);
        order.setStatus(OrderStatus.CANCELLED);
        when(orders.findByIdForUpdate(4L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.pay(4L, PaymentMethod.CARD, "tok_abc", "1111"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no admite cobro");
    }
}
