package com.sgologic.invoicing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sgologic.audit.AuditService;
import com.sgologic.common.Channel;
import com.sgologic.external.Provider;
import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.external.SatClient;
import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxService;
import com.sgologic.orders.OrderStatus;
import com.sgologic.orders.PurchaseOrder;
import com.sgologic.orders.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * CDU-03: ninguna orden pasa a INVOICED (y por lo tanto a despacho) sin que la SAT acepte el
 * documento. Un rechazo o la ausencia de respuesta deben poder reintentarse, nunca perder la
 * orden.
 */
class InvoicingServiceTest {

    private InvoiceRepository invoices;
    private PurchaseOrderRepository orders;
    private InvoiceXmlBuilder xmlBuilder;
    private SatClient sat;
    private OutboxService outbox;
    private AuditService audit;
    private TransactionTemplate tx;
    private InvoicingService service;

    /** La factura tal como quedaría "persistida" tras el último invoices.save(...). */
    private Invoice lastSaved;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        invoices = mock(InvoiceRepository.class);
        orders = mock(PurchaseOrderRepository.class);
        xmlBuilder = mock(InvoiceXmlBuilder.class);
        sat = mock(SatClient.class);
        outbox = mock(OutboxService.class);
        audit = mock(AuditService.class);
        tx = mock(TransactionTemplate.class);
        lastSaved = null;

        when(tx.execute(any(TransactionCallback.class))).thenAnswer(inv -> {
            TransactionCallback<?> callback = inv.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        });
        doAnswer(inv -> {
            java.util.function.Consumer<TransactionStatus> action = inv.getArgument(0);
            action.accept(mock(TransactionStatus.class));
            return null;
        }).when(tx).executeWithoutResult(any());

        when(xmlBuilder.build(anyLong(), any(), any())).thenReturn("<xml/>");
        when(invoices.save(any(Invoice.class))).thenAnswer(inv -> {
            Invoice invoice = inv.getArgument(0);
            if (invoice.getId() == null) {
                invoice.setId(77L);
            }
            lastSaved = invoice;
            return invoice;
        });
        when(invoices.findById(77L)).thenAnswer(inv -> Optional.ofNullable(lastSaved));

        service = new InvoicingService(invoices, orders, xmlBuilder, sat, outbox, audit, tx);
        // "series" lo inyecta Spring vía @Value en producción; aquí se arma el servicio a mano.
        org.springframework.test.util.ReflectionTestUtils.setField(service, "series", "A");
    }

    private PurchaseOrder paidOrder(Long id) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(id);
        order.setCustomerId(1L);
        order.setChannel(Channel.WEB);
        order.setStatus(OrderStatus.PAID);
        order.setTotal(new BigDecimal("100.00"));
        order.setDeliveryAddress("dirección");
        return order;
    }

    @Test
    void la_sat_acepta_la_factura_y_la_orden_pasa_a_facturada() {
        PurchaseOrder order = paidOrder(1L);
        when(orders.findById(1L)).thenReturn(Optional.of(order));
        when(invoices.findByOrderId(1L)).thenReturn(Optional.empty());
        when(sat.send(any(), any())).thenReturn(new SatClient.SatResponse(true, "documento aceptado"));

        Invoice invoice = service.issue(1L);

        assertThat(invoice.getStatus()).isEqualTo(InvoiceStatus.ACCEPTED);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.INVOICED);
        verify(outbox).publishForOrder(eq(1L), eq(EventTypes.ORDER_INVOICED), any());
    }

    @Test
    void rechaza_facturar_una_orden_que_todavia_no_esta_pagada() {
        PurchaseOrder order = paidOrder(2L);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        when(orders.findById(2L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.issue(2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no está pagada");

        verify(sat, never()).send(any(), any());
    }

    @Test
    void si_la_sat_rechaza_el_documento_la_orden_no_avanza_a_facturada() {
        PurchaseOrder order = paidOrder(3L);
        when(orders.findById(3L)).thenReturn(Optional.of(order));
        when(invoices.findByOrderId(3L)).thenReturn(Optional.empty());
        when(sat.send(any(), any()))
                .thenReturn(new SatClient.SatResponse(false, "serie no autorizada para el emisor"));

        assertThatThrownBy(() -> service.issue(3L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("rechazó");

        assertThat(order.getStatus()).isNotEqualTo(OrderStatus.INVOICED);
    }

    @Test
    void si_la_sat_no_responde_el_error_se_propaga_para_que_el_evento_se_reintente() {
        PurchaseOrder order = paidOrder(4L);
        when(orders.findById(4L)).thenReturn(Optional.of(order));
        when(invoices.findByOrderId(4L)).thenReturn(Optional.empty());
        when(sat.send(any(), any())).thenThrow(
                new ProviderUnavailableException(Provider.SAT, 5000, true, "la SAT tardó más de la ventana tolerable"));

        assertThatThrownBy(() -> service.issue(4L)).isInstanceOf(ProviderUnavailableException.class);

        assertThat(order.getStatus()).isNotEqualTo(OrderStatus.INVOICED);
        assertThat(lastSaved.getStatus()).isEqualTo(InvoiceStatus.SENT);
    }
}
