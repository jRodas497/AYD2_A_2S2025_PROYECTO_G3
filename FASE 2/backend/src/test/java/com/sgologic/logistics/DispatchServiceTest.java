package com.sgologic.logistics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sgologic.audit.AuditService;
import com.sgologic.common.CircuitBreaker;
import com.sgologic.config.SettingsService;
import com.sgologic.external.CircuitBreakers;
import com.sgologic.external.LogiExpressClient;
import com.sgologic.external.Provider;
import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.integration.pos.PosEventService;
import com.sgologic.inventory.LocationType;
import com.sgologic.inventory.ReservationLifecycleService;
import com.sgologic.inventory.ReservationLifecycleService.ReservedLine;
import com.sgologic.notifications.NotificationService;
import com.sgologic.orders.OrderStatus;
import com.sgologic.orders.PurchaseOrder;
import com.sgologic.orders.PurchaseOrderRepository;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * CDU-04: ninguna mercancía sale sin factura válida, y una falla de LogiExpress no debe
 * bloquear el despacho ya asignado — el envío se queda sin guía hasta que el reintento (o
 * Logística a mano) la consiga.
 */
class DispatchServiceTest {

    private ShipmentRepository shipments;
    private TrackingEventRepository trackingEvents;
    private PurchaseOrderRepository orders;
    private ReservationLifecycleService reservations;
    private PosEventService posEvents;
    private NotificationService notifications;
    private LogiExpressClient logiexpress;
    private CircuitBreakers breakers;
    private AuditService audit;
    private SettingsService settings;
    private JdbcTemplate jdbc;
    private TransactionTemplate tx;
    private com.sgologic.inventory.StockTransferService transfers;
    private DispatchService service;

    /** Simula la fila del envío: lo que `save` guarda es lo que `findById` devuelve después. */
    private Shipment savedShipment;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        transfers = mock(com.sgologic.inventory.StockTransferService.class);
        shipments = mock(ShipmentRepository.class);
        trackingEvents = mock(TrackingEventRepository.class);
        orders = mock(PurchaseOrderRepository.class);
        reservations = mock(ReservationLifecycleService.class);
        posEvents = mock(PosEventService.class);
        notifications = mock(NotificationService.class);
        logiexpress = mock(LogiExpressClient.class);
        breakers = mock(CircuitBreakers.class);
        audit = mock(AuditService.class);
        settings = mock(SettingsService.class);
        jdbc = mock(JdbcTemplate.class);
        tx = mock(TransactionTemplate.class);
        savedShipment = null;

        when(breakers.of(Provider.LOGIEXPRESS))
                .thenReturn(new CircuitBreaker("LOGIEXPRESS", 3, Duration.ofSeconds(20)));
        when(settings.reservationTtlMinutes()).thenReturn(20);

        when(tx.execute(any(TransactionCallback.class))).thenAnswer(inv -> {
            TransactionCallback<?> callback = inv.getArgument(0);
            return callback.doInTransaction(mock(TransactionStatus.class));
        });
        doAnswer(inv -> {
            java.util.function.Consumer<TransactionStatus> action = inv.getArgument(0);
            action.accept(mock(TransactionStatus.class));
            return null;
        }).when(tx).executeWithoutResult(any());

        when(shipments.save(any(Shipment.class))).thenAnswer(inv -> {
            Shipment shipment = inv.getArgument(0);
            if (shipment.getId() == null) {
                shipment.setId(900L);
            }
            savedShipment = shipment;
            return shipment;
        });
        when(shipments.findById(900L)).thenAnswer(inv -> Optional.ofNullable(savedShipment));
        when(shipments.findByIdForUpdate(900L)).thenAnswer(inv -> Optional.ofNullable(savedShipment));

        service = new DispatchService(shipments, trackingEvents, orders, reservations, posEvents, notifications,
                logiexpress, breakers, audit, settings, jdbc, tx, mock(com.sgologic.integration.OutboxService.class), transfers);
    }

    private PurchaseOrder invoicedOrder(Long id) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(id);
        order.setStatus(OrderStatus.INVOICED);
        order.setDeliveryAddress("Zona 1, Ciudad de Guatemala");
        return order;
    }

    @Test
    void despacha_desde_el_origen_con_mas_unidades_y_obtiene_la_guia() {
        PurchaseOrder order = invoicedOrder(1L);
        when(orders.findById(1L)).thenReturn(Optional.of(order));
        when(orders.findByIdForUpdate(1L)).thenReturn(Optional.of(order));
        when(orders.findByIdForUpdate(1L)).thenReturn(Optional.of(order));
        when(shipments.findFirstByOrderIdOrderByIdDesc(1L)).thenReturn(Optional.empty());

        ReservedLine line = new ReservedLine(10L, 5L, "CD1", LocationType.DISTRIBUTION_CENTER, 100L, 2);
        when(reservations.ensureReservedForDispatch(1L, 20)).thenReturn(List.of(line));

        when(jdbc.queryForObject(anyString(), eq(String.class), any()))
                .thenReturn("Zona 1, Ciudad de Guatemala", "CD1");
        when(logiexpress.requestGuide(eq(900L), eq("CD1"), anyString()))
                .thenReturn(new LogiExpressClient.GuideResponse("LX-123456789", 80));

        Shipment result = service.dispatch(1L);

        assertThat(result.getStatus()).isEqualTo(ShipmentStatus.GUIDE_ISSUED);
        assertThat(result.getTrackingNumber()).isEqualTo("LX-123456789");
        assertThat(order.getStatus()).isEqualTo(OrderStatus.IN_DISPATCH);
        verify(reservations).consume(1L, List.of(line));
        // El origen es un centro de distribución: no se notifica a ningún POS de tienda.
        verify(posEvents, never()).publish(any(), any(), any());
    }

    @Test
    void espera_la_recepcion_de_traslados_antes_de_consumir_stock_o_crear_envio() {
        PurchaseOrder order=invoicedOrder(8L);
        when(orders.findByIdForUpdate(8L)).thenReturn(Optional.of(order));
        var lines=List.of(new ReservedLine(1L,5L,"CD1",LocationType.DISTRIBUTION_CENTER,100L,2),
                         new ReservedLine(2L,6L,"B1",LocationType.WAREHOUSE,101L,1));
        when(reservations.ensureReservedForDispatch(8L,20)).thenReturn(lines);
        when(transfers.consolidate(8L,5L,lines)).thenReturn(true);
        assertThat(service.dispatch(8L)).isNull();
        assertThat(order.getStatus()).isEqualTo(OrderStatus.INVOICED);
        verify(reservations,never()).consume(any(),any());
        verify(shipments,never()).save(any());
        verify(logiexpress,never()).requestGuide(any(),any(),any());
    }

    @Test
    void un_rastreo_tardio_del_proveedor_no_modifica_el_transporte_manual() {
        Shipment shipment=new Shipment();shipment.setId(8L);shipment.setOrderId(8L);
        shipment.setCarrier(Carrier.MANUAL);shipment.setTrackingNumber("MANUAL-8");
        shipment.setStatus(ShipmentStatus.GUIDE_ISSUED);
        when(shipments.findById(8L)).thenReturn(Optional.of(shipment));
        when(shipments.findByIdForUpdate(8L)).thenReturn(Optional.of(shipment));
        when(orders.findByIdForUpdate(8L)).thenReturn(Optional.of(invoicedOrder(8L)));
        assertThatThrownBy(()->service.applyProviderTracking(8L,ShipmentStatus.DELIVERED,"tardío","LX-OLD"))
            .isInstanceOf(ResponseStatusException.class).hasMessageContaining("transportista o guía vigente");
        assertThat(shipment.getStatus()).isEqualTo(ShipmentStatus.GUIDE_ISSUED);
        assertThat(shipment.getTrackingNumber()).isEqualTo("MANUAL-8");
        verify(trackingEvents,never()).save(any());
    }

    @Test
    void no_despacha_una_orden_que_todavia_no_esta_facturada() {
        PurchaseOrder order = invoicedOrder(2L);
        order.setStatus(OrderStatus.PAID);
        when(orders.findById(2L)).thenReturn(Optional.of(order));
        when(orders.findByIdForUpdate(2L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.dispatch(2L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("no está facturada");

        verify(shipments, never()).save(any());
        verify(reservations, never()).ensureReservedForDispatch(any(), anyInt());
    }

    @Test
    void no_despacha_una_orden_cancelada() {
        PurchaseOrder order = invoicedOrder(3L);
        order.setStatus(OrderStatus.CANCELLED);
        when(orders.findById(3L)).thenReturn(Optional.of(order));
        when(orders.findByIdForUpdate(3L)).thenReturn(Optional.of(order));

        assertThatThrownBy(() -> service.dispatch(3L))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("está CANCELLED");
    }

    @Test
    void si_logiexpress_no_responde_el_envio_queda_asignado_sin_guia_para_reintentar() {
        Shipment shipment = new Shipment();
        shipment.setId(901L);
        shipment.setOrderId(4L);
        shipment.setOriginLocationId(5L);
        shipment.setStatus(ShipmentStatus.ASSIGNED);
        when(orders.findByIdForUpdate(4L)).thenReturn(Optional.of(invoicedOrder(4L)));
        when(shipments.findById(901L)).thenReturn(Optional.of(shipment));
        when(shipments.findByIdForUpdate(901L)).thenReturn(Optional.of(shipment));
        when(jdbc.queryForObject(anyString(), eq(String.class), any()))
                .thenReturn("dirección", "CD1");
        when(logiexpress.requestGuide(any(), any(), any()))
                .thenThrow(new ProviderUnavailableException(
                        Provider.LOGIEXPRESS, 5000, true, "LogiExpress respondió con timeout"));

        assertThatThrownBy(() -> service.requestGuide(901L)).isInstanceOf(ProviderUnavailableException.class);

        assertThat(shipment.getStatus()).isEqualTo(ShipmentStatus.GUIDE_REQUESTED);
        assertThat(shipment.getTrackingNumber()).isNull();
    }

    @Test
    void con_el_circuito_de_logiexpress_abierto_no_se_intenta_pedir_la_guia() {
        Shipment shipment = new Shipment();
        shipment.setId(902L);
        shipment.setOrderId(5L);
        shipment.setOriginLocationId(5L);
        shipment.setStatus(ShipmentStatus.ASSIGNED);
        when(shipments.findById(902L)).thenReturn(Optional.of(shipment));

        CircuitBreaker openBreaker = new CircuitBreaker("LOGIEXPRESS", 1, Duration.ofSeconds(20));
        openBreaker.recordFailure();
        when(breakers.of(Provider.LOGIEXPRESS)).thenReturn(openBreaker);

        assertThatThrownBy(() -> service.requestGuide(902L)).isInstanceOf(ProviderUnavailableException.class);

        verify(logiexpress, never()).requestGuide(any(), any(), any());
    }
}
