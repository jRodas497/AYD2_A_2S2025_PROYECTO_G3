package com.sgologic.logistics;

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
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Despacho y entrega de una orden facturada (CDU-04).
 *
 * <p>Son dos cosas separadas a propósito: <em>preparar el despacho</em> (elegir el punto de
 * origen, bajar el inventario, avisarle al POS de la tienda) es trabajo propio y se confirma en
 * una transacción; <em>pedir la guía</em> depende de LogiExpress, que falla ~2% de las veces, y
 * ocurre después. Por eso un timeout del transportista no deja la orden sin despachar: deja un
 * envío sin número de guía, que se reintenta solo y, si se agota, queda listado en
 * {@code GET /api/shipments?status=GUIDE_REQUESTED} para que Logística lo resuelva a mano.
 */
@Service
public class DispatchService {

    private static final Logger log = LoggerFactory.getLogger(DispatchService.class);

    private final ShipmentRepository shipments;
    private final TrackingEventRepository trackingEvents;
    private final PurchaseOrderRepository orders;
    private final ReservationLifecycleService reservations;
    private final PosEventService posEvents;
    private final NotificationService notifications;
    private final LogiExpressClient logiexpress;
    private final CircuitBreakers breakers;
    private final AuditService audit;
    private final SettingsService settings;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public DispatchService(
            ShipmentRepository shipments,
            TrackingEventRepository trackingEvents,
            PurchaseOrderRepository orders,
            ReservationLifecycleService reservations,
            PosEventService posEvents,
            NotificationService notifications,
            LogiExpressClient logiexpress,
            CircuitBreakers breakers,
            AuditService audit,
            SettingsService settings,
            JdbcTemplate jdbc,
            TransactionTemplate tx) {
        this.shipments = shipments;
        this.trackingEvents = trackingEvents;
        this.orders = orders;
        this.reservations = reservations;
        this.posEvents = posEvents;
        this.notifications = notifications;
        this.logiexpress = logiexpress;
        this.breakers = breakers;
        this.audit = audit;
        this.settings = settings;
        this.jdbc = jdbc;
        this.tx = tx;
    }

    /**
     * Despacha una orden facturada: asigna el punto de despacho, saca la mercancía del
     * inventario y pide la guía. Llamarlo dos veces no crea dos envíos.
     */
    public Shipment dispatch(Long orderId) {
        Long shipmentId = tx.execute(status -> prepare(orderId));
        return requestGuide(shipmentId);
    }

    private Long prepare(Long orderId) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId).orElseThrow();

        if (order.getStatus() == OrderStatus.PENDING_PAYMENT
                || order.getStatus() == OrderStatus.PAYMENT_IN_PROGRESS
                || order.getStatus() == OrderStatus.PAYMENT_FAILED
                || order.getStatus() == OrderStatus.PAID) {
            // Regla dura del caso: ninguna mercancía sale sin factura válida.
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "la orden " + orderId + " no está facturada; no se despacha sin documento fiscal");
        }
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.RETURNED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "la orden " + orderId + " está " + order.getStatus().code());
        }

        var existing = shipments.findFirstByOrderIdOrderByIdDesc(orderId);
        if (existing.isPresent()) {
            return existing.get().getId();
        }

        List<ReservedLine> lines =
                reservations.ensureReservedForDispatch(orderId, settings.reservationTtlMinutes());
        if (lines.isEmpty()) {
            throw new IllegalStateException("la orden " + orderId + " no tiene mercancía reservada que despachar");
        }

        ReservedLine origin = chooseOrigin(lines);
        reservations.consume(orderId, lines);

        Shipment shipment = new Shipment();
        shipment.setOrderId(orderId);
        shipment.setOriginLocationId(origin.locationId());
        shipment.setCarrier(order.getPickupLocationId()==null ? Carrier.LOGIEXPRESS : Carrier.PICKUP);
        shipment.setStatus(ShipmentStatus.ASSIGNED);
        shipment = shipments.save(shipment);

        trackingEvents.save(new TrackingEvent(shipment.getId(), ShipmentStatus.ASSIGNED,
                "Despacho asignado desde " + origin.locationCode()));

        order.setStatus(OrderStatus.IN_DISPATCH);
        order.setUpdatedAt(OffsetDateTime.now());

        notifyStores(orderId, lines, "despacho");
        audit.recordSystem("DESPACHO_ASIGNADO", "shipment", shipment.getId(), orderId, order.getChannel(),
                Map.of("origen", origin.locationCode(), "lineas", lines.size()));
        notifications.queueForOrder(orderId,
                "Tu orden " + orderId + " está en preparación desde " + origin.locationCode() + ".");

        log.info("orden {} en despacho desde {} (envío {})", orderId, origin.locationCode(), shipment.getId());
        return shipment.getId();
    }

    /**
     * Pide la guía a LogiExpress. Si el proveedor no responde, lanza para que el evento se
     * reintente; el envío se queda esperando guía, pero la orden ya está despachándose.
     */
    public Shipment requestGuide(Long shipmentId) {
        Shipment shipment = loadShipment(shipmentId);
        if (shipment.getTrackingNumber() != null) {
            return shipment;
        }

        if(shipment.getCarrier()==Carrier.PICKUP) return tx.execute(status -> applyGuide(shipmentId,"PICKUP-"+shipmentId));
        CircuitBreaker breaker = breakers.of(Provider.LOGIEXPRESS);
        if (!breaker.allowsRequest()) {
            // Degradación controlada: ni se intenta, el evento vuelve a la cola.
            throw new ProviderUnavailableException(Provider.LOGIEXPRESS, 0, false,
                    "circuito abierto: LogiExpress viene fallando, la guía se pide más tarde");
        }

        GuideRequest request = tx.execute(status -> markGuideRequested(shipmentId));

        try {
            LogiExpressClient.GuideResponse guide = logiexpress.requestGuide(
                    shipmentId, request.originCode(), request.deliveryAddress());
            breaker.recordSuccess();
            return tx.execute(status -> {
                Shipment current=loadShipmentForUpdate(shipmentId);
                if(!locationCodeOf(current.getOriginLocationId()).equals(request.originCode()))
                    throw new ProviderUnavailableException(Provider.LOGIEXPRESS,0,false,"el origen cambió; se requiere una guía nueva");
                return applyGuide(shipmentId,guide.trackingNumber());
            });
        } catch (ProviderUnavailableException e) {
            breaker.recordFailure();
            tx.executeWithoutResult(status -> recordGuideFailure(shipmentId, e.getMessage()));
            throw e;
        }
    }

    /**
     * Se agotaron los reintentos con LogiExpress (CDU-04, E1): queda la alerta operativa para
     * que Logística asigne el transporte a mano. La orden no se pierde ni se revierte.
     */
    public void alertLogistics(Long orderId, String lastError) {
        tx.executeWithoutResult(status -> {
            shipments.findFirstByOrderIdOrderByIdDesc(orderId).ifPresent(shipment -> {
                trackingEvents.save(new TrackingEvent(shipment.getId(), ShipmentStatus.GUIDE_REQUESTED,
                        "Sin guía tras agotar los reintentos: requiere asignación manual de transporte"));
                audit.recordSystem("GUIA_ESCALADA", "shipment", shipment.getId(), orderId, null,
                        Map.of("motivo", String.valueOf(lastError),
                               "accion", "asignación manual de transporte por parte de Logística"));
                log.error("el envío {} de la orden {} necesita asignación manual: {}",
                        shipment.getId(), orderId, lastError);
            });
        });
    }

    /**
     * Cambia el punto de despacho de una orden ya preparada (CDU-04, flujo 1a): devuelve la
     * mercancía a donde estaba y la toma del nuevo origen, sin reiniciar el proceso ni perder
     * la trazabilidad.
     *
     * <p>Se puede mientras la mercancía no haya salido. Si la guía ya estaba emitida, se anula y
     * se pide una nueva desde el origen correcto — mandar la guía vieja sería despachar desde
     * una bodega que ya no tiene el producto, que es justo el error de despacho que hay que
     * bajar un 70%.
     */
    public Shipment reassign(Long shipmentId, String locationCode) {
        boolean guideWasIssued = Boolean.TRUE.equals(tx.execute(status -> {
            Shipment shipment = loadShipmentForUpdate(shipmentId);
            orders.findByIdForUpdate(shipment.getOrderId()).orElseThrow();
            if (shipment.getStatus() != ShipmentStatus.ASSIGNED
                    && shipment.getStatus() != ShipmentStatus.GUIDE_REQUESTED
                    && shipment.getStatus() != ShipmentStatus.GUIDE_ISSUED) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "el envío " + shipmentId + " ya está " + shipment.getStatus().code()
                                + "; el punto de despacho solo se cambia mientras la mercancía no haya salido");
            }

            Long newLocationId = locationIdOf(locationCode);
            List<ReservedLine> before = reservations.confirmedLines(shipment.getOrderId());
            List<ReservedLine> after = reservations.moveOrigin(shipment.getOrderId(), newLocationId, before);

            shipment.setOriginLocationId(newLocationId);
            shipment.setUpdatedAt(OffsetDateTime.now());
            trackingEvents.save(new TrackingEvent(shipmentId, shipment.getStatus(),
                    "Punto de despacho reasignado a " + locationCode));

            boolean hadGuide = shipment.getTrackingNumber() != null;
            if (hadGuide) {
                trackingEvents.save(new TrackingEvent(shipmentId, ShipmentStatus.GUIDE_REQUESTED,
                        "Guía " + shipment.getTrackingNumber() + " anulada: cambió el punto de despacho"));
                shipment.setTrackingNumber(null);
                shipment.setStatus(ShipmentStatus.GUIDE_REQUESTED);
            }

            notifyStores(shipment.getOrderId(), before, "reasignación: devolución al origen anterior");
            notifyStores(shipment.getOrderId(), after, "reasignación: salida del nuevo origen");
            audit.recordSystem("DESPACHO_REASIGNADO", "shipment", shipmentId, shipment.getOrderId(), null,
                    Map.of("nuevoOrigen", locationCode, "guiaAnulada", hadGuide));
            return hadGuide;
        }));

        if (guideWasIssued) {
            try {
                return requestGuide(shipmentId);
            } catch (ProviderUnavailableException e) {
                // El envío ya quedó reasignado; la guía nueva se pide sola en el siguiente intento.
                log.warn("el envío {} se reasignó pero sigue sin guía: {}", shipmentId, e.getMessage());
            }
        }
        return byId(shipmentId);
    }

    /**
     * Actualización de estado que manda LogiExpress. Al entregarse, la orden pasa a entregada y
     * el cliente recibe el aviso.
     */
    public Shipment applyTrackingUpdate(Long shipmentId, ShipmentStatus status, String detail) {
        return tx.execute(tstatus -> {
            Shipment shipment = loadShipmentForUpdate(shipmentId);
            orders.findByIdForUpdate(shipment.getOrderId()).orElseThrow();
            if (shipment.getStatus() == status) return shipment;
            if (shipment.getStatus() == ShipmentStatus.DELIVERED) throw new ResponseStatusException(HttpStatus.CONFLICT,"el envío ya fue entregado");
            if ((status == ShipmentStatus.IN_TRANSIT || status == ShipmentStatus.DELIVERED) && shipment.getTrackingNumber()==null)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"se requiere una guía antes de actualizar la entrega");
            if(status != ShipmentStatus.IN_TRANSIT && status != ShipmentStatus.DELIVERED && status != ShipmentStatus.FAILED)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"transición logística no permitida");
            PurchaseOrder owningOrder=orders.findByIdForUpdate(shipment.getOrderId()).orElseThrow();
            if(owningOrder.getStatus()==OrderStatus.RETURNED || owningOrder.getStatus()==OrderStatus.CANCELLED)
                throw new ResponseStatusException(HttpStatus.CONFLICT,"la orden ya está cerrada");
            shipment.setStatus(status);
            shipment.setUpdatedAt(OffsetDateTime.now());
            trackingEvents.save(new TrackingEvent(shipmentId, status, detail));

            PurchaseOrder order = loadOrder(shipment.getOrderId());
            if (status == ShipmentStatus.DELIVERED) {
                order.setStatus(OrderStatus.DELIVERED);
                order.setUpdatedAt(OffsetDateTime.now());
                notifications.queueForOrder(order.getId(), "Tu orden " + order.getId() + " fue entregada.");
            } else if (status == ShipmentStatus.IN_TRANSIT) {
                notifications.queueForOrder(order.getId(),
                        "Tu orden " + order.getId() + " va en camino. Guía " + shipment.getTrackingNumber() + ".");
            } else if (status == ShipmentStatus.FAILED) {
                notifications.queueForOrder(order.getId(),
                        "Hubo un problema con la entrega de tu orden " + order.getId()
                                + ". Nos comunicaremos contigo.");
            }

            audit.recordSystem("ENVIO_" + status.code(), "shipment", shipmentId, order.getId(),
                    order.getChannel(), Map.of("detalle", String.valueOf(detail)));
            return shipment;
        });
    }

    public Shipment ofOrder(Long orderId) {
        return shipments.findFirstByOrderIdOrderByIdDesc(orderId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "la orden " + orderId + " todavía no tiene envío"));
    }

    public Shipment byId(Long shipmentId) {
        return loadShipment(shipmentId);
    }

    public List<TrackingEvent> trackingOf(Long shipmentId) {
        return trackingEvents.findByShipmentIdOrderByIdAsc(shipmentId);
    }

    public List<Shipment> byStatus(ShipmentStatus status, int limit) {
        return shipments.findByStatusOrderByIdDesc(status, org.springframework.data.domain.Limit.of(limit));
    }

    public String locationCodeOf(Long locationId) {
        return jdbc.queryForObject("select code from inventory.location where id = ?", String.class, locationId);
    }

    /**
     * Elige el punto de despacho: la ubicación que tiene la mayor parte de la orden y, a igual
     * cantidad, primero un centro de distribución. Es la decisión que CDU-04 le corresponde a
     * Logística, distinta de la ubicación que eligió la reserva al hacer el checkout.
     */
    private ReservedLine chooseOrigin(List<ReservedLine> lines) {
        Map<Long, Integer> unitsByLocation = lines.stream().collect(
                Collectors.groupingBy(ReservedLine::locationId, Collectors.summingInt(ReservedLine::quantity)));
        return lines.stream()
                .max(Comparator
                        .comparingInt((ReservedLine line) -> unitsByLocation.get(line.locationId()))
                        .thenComparingInt(line -> line.locationType() == LocationType.DISTRIBUTION_CENTER ? 1 : 0))
                .orElseThrow();
    }

    /** Le avisa al POS de cada tienda cuyo inventario se movió, para que las 32 queden coherentes. */
    private void notifyStores(Long orderId, List<ReservedLine> lines, String reason) {
        lines.stream()
                .filter(line -> line.locationType() == LocationType.STORE)
                .forEach(line -> posEvents.publish(line.locationId(), PosEventService.STOCK_ADJUSTED,
                        Map.of("orderId", orderId, "productId", line.productId(),
                               "quantity", line.quantity(), "motivo", reason)));
    }

    private GuideRequest markGuideRequested(Long shipmentId) {
        Shipment shipment = loadShipmentForUpdate(shipmentId);
        if (shipment.getStatus() == ShipmentStatus.ASSIGNED) {
            shipment.setStatus(ShipmentStatus.GUIDE_REQUESTED);
            shipment.setUpdatedAt(OffsetDateTime.now());
            trackingEvents.save(new TrackingEvent(shipmentId, ShipmentStatus.GUIDE_REQUESTED,
                    "Guía solicitada a LogiExpress"));
        }
        String address = jdbc.queryForObject(
                "select delivery_address from orders.purchase_order where id = ?",
                String.class, shipment.getOrderId());
        return new GuideRequest(locationCodeOf(shipment.getOriginLocationId()), address);
    }

    private Shipment applyGuide(Long shipmentId, String trackingNumber) {
        Shipment shipment = loadShipmentForUpdate(shipmentId);
        if(shipment.getTrackingNumber()!=null) return shipment;
        shipment.setTrackingNumber(trackingNumber);
        shipment.setStatus(ShipmentStatus.GUIDE_ISSUED);
        shipment.setUpdatedAt(OffsetDateTime.now());
        trackingEvents.save(new TrackingEvent(shipmentId, ShipmentStatus.GUIDE_ISSUED,
                "Guía " + trackingNumber + " emitida por LogiExpress"));
        audit.recordSystem("GUIA_EMITIDA", "shipment", shipmentId, shipment.getOrderId(), null,
                Map.of("guia", trackingNumber));
        notifications.queueForOrder(shipment.getOrderId(),
                shipment.getCarrier()==Carrier.PICKUP ? "Tu orden " + shipment.getOrderId() + " está lista para retirar en " + locationCodeOf(shipment.getOriginLocationId()) : "Tu orden " + shipment.getOrderId() + " ya tiene guía de rastreo: " + trackingNumber + ".");
        log.info("envío {} con guía {}", shipmentId, trackingNumber);
        return shipment;
    }

    private void recordGuideFailure(Long shipmentId, String error) {
        Shipment shipment = loadShipmentForUpdate(shipmentId);
        if(shipment.getTrackingNumber()!=null) return;
        trackingEvents.save(new TrackingEvent(shipmentId, ShipmentStatus.GUIDE_REQUESTED,
                "LogiExpress no emitió la guía: " + error));
        audit.recordSystem("GUIA_FALLIDA", "shipment", shipmentId, shipment.getOrderId(), null,
                Map.of("motivo", String.valueOf(error)));
    }

    private Long locationIdOf(String code) {
        List<Long> found = jdbc.queryForList(
                "select id from inventory.location where code = ?", Long.class, code);
        if (found.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ubicación no encontrada: " + code);
        }
        return found.get(0);
    }

    private Shipment loadShipmentForUpdate(Long id) {
        return shipments.findByIdForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"envío no encontrado"));
    }

    private Shipment loadShipment(Long shipmentId) {
        return shipments.findById(shipmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "envío no encontrado"));
    }

    private PurchaseOrder loadOrder(Long orderId) {
        return orders.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
    }

    private record GuideRequest(String originCode, String deliveryAddress) {
    }
}
