package com.sgologic.orders;

import com.sgologic.audit.AuditService;
import com.sgologic.notifications.NotificationService;
import java.time.OffsetDateTime;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * RF: Gestión de Incidencias — registrar y procesar cambios/devoluciones desde una vista centralizada.
 *
 * <p>Cada alta y cada cambio de estado queda en la auditoría con quién lo hizo (el usuario del token,
 * si viene) y el cliente recibe el aviso: la hoja de calificación pide "cambios, devoluciones e
 * incidencias auditables". Una devolución resuelta deja la orden en RETURNED, y una incidencia ya
 * resuelta o rechazada no se reabre.
 */
@Service
public class IncidentService {

    /** Estados de orden en los que la mercancía ya se cobró: solo ahí una devolución cambia la orden. */
    private static final Set<OrderStatus> RETURNABLE =
            Set.of(OrderStatus.PAID, OrderStatus.INVOICED, OrderStatus.IN_DISPATCH, OrderStatus.DELIVERED);

    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.payments.RefundService refunds;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.catalog.ProductRepository products;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.catalog.PricingService pricing;
    @org.springframework.beans.factory.annotation.Autowired
    private OrderItemRepository orderItems;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.inventory.InventoryReservationService reservations;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.config.SettingsService settings;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;
    private final IncidentRepository incidents;
    private final PurchaseOrderRepository orders;
    private final AuditService audit;
    private final NotificationService notifications;

    public IncidentService(
            IncidentRepository incidents,
            PurchaseOrderRepository orders,
            AuditService audit,
            NotificationService notifications) {
        this.incidents = incidents;
        this.orders = orders;
        this.audit = audit;
        this.notifications = notifications;
    }

    @Transactional
    public Incident register(Long orderId, IncidentType type, String description) {
        PurchaseOrder order = orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
        if(!RETURNABLE.contains(order.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"solo se admiten solicitudes para compras confirmadas");
        if(jdbc.queryForObject("select exists(select 1 from orders.incident where order_id=? and type_id=? and status_id in (1,2))",Boolean.class,orderId,type.id()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"ya existe una solicitud abierta de este tipo");
        Incident incident = new Incident();
        incident.setOrderId(orderId);
        incident.setType(type);
        incident.setDescription(description);
        incident.setStatus(IncidentStatus.REGISTERED);
        incident = incidents.saveAndFlush(incident);

        audit.record(actor(), "INCIDENCIA_REGISTRADA", "incident", incident.getId(), orderId, order.getChannel(),
                Map.of("tipo", type.code(), "descripcion", description));
        notifications.queueForOrder(orderId,
                "Registramos tu solicitud de " + (type == IncidentType.RETURN ? "devolución" : "cambio")
                        + " de la orden " + orderId + " (incidencia " + incident.getId() + ").");
        return incident;
    }

    public List<Incident> findByOrder(Long orderId) {
        return incidents.findByOrderId(orderId);
    }

    public Incident findById(Long incidentId) {
        return incidents.findById(incidentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "incidencia no encontrada"));
    }

    /** Las incidencias de todas las órdenes de un cliente, las más recientes primero. */
    public List<Incident> findByCustomer(Long customerId, int limit) {
        return incidents.findByCustomer(customerId, org.springframework.data.domain.PageRequest.of(0, limit));
    }

    @Transactional
    public Incident updateStatus(Long incidentId, IncidentStatus status) {
        Incident incident = incidents.findByIdForUpdate(incidentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"incidencia no encontrada"));
        IncidentStatus previous = incident.getStatus();
        if (previous.isClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "la incidencia " + incidentId + " ya está " + previous.code() + " y no se puede cambiar");
        }
        if (status == IncidentStatus.REGISTERED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "una incidencia no puede volver a REGISTERED");
        }

        PurchaseOrder lockedOrder=orders.findByIdForUpdate(incident.getOrderId()).orElseThrow();
        if(status==IncidentStatus.RESOLVED && incident.getType()==IncidentType.EXCHANGE && incident.getReplacementOrderId()==null)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"selecciona el producto de reemplazo para resolver el cambio");
        if(status==IncidentStatus.RESOLVED) {
            var authentication=SecurityContextHolder.getContext().getAuthentication();
            BigDecimal threshold=new BigDecimal(jdbc.queryForObject("select value from config.setting where key='refund.finance_threshold_q'",String.class));
            boolean finance=authentication!=null && authentication.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN") || a.getAuthority().equals("ROLE_FINANCE"));
            if(lockedOrder.getTotal().compareTo(threshold)>0 && !finance) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"esta devolución requiere aprobación de Finanzas");
        }
        incident.setStatus(status);
        if (status.isClosed()) {
            incident.setResolvedAt(OffsetDateTime.now());
        }
        incident = incidents.save(incident);

        PurchaseOrder order = orders.findById(incident.getOrderId()).orElseThrow();
        if (status == IncidentStatus.RESOLVED
                && RETURNABLE.contains(order.getStatus())) {
            refunds.queue(order);
            order.setStatus(OrderStatus.RETURNED);
            order.setUpdatedAt(OffsetDateTime.now());
        }

        audit.record(actor(), "INCIDENCIA_" + status.code(), "incident", incidentId, order.getId(), order.getChannel(),
                Map.of("tipo", incident.getType().code(), "desde", previous.code(), "hasta", status.code()));
        if (status.isClosed()) {
            notifications.queueForOrder(order.getId(),
                    "Tu solicitud " + incidentId + " de la orden " + order.getId() + " fue "
                            + (status == IncidentStatus.RESOLVED ? "resuelta" : "rechazada") + ".");
        }
        return incident;
    }

    @Transactional
    public PurchaseOrder exchange(Long id,Long productId,int quantity) {
        Incident incident=incidents.findByIdForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"incidencia no encontrada"));
        if(incident.getType()!=IncidentType.EXCHANGE) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"la solicitud no es un cambio");
        if(incident.getReplacementOrderId()!=null) return orders.findById(incident.getReplacementOrderId()).orElseThrow();
        if(incident.getStatus().isClosed()) throw new ResponseStatusException(HttpStatus.CONFLICT,"solicitud cerrada");
        PurchaseOrder original=orders.findByIdForUpdate(incident.getOrderId()).orElseThrow();
        if(!RETURNABLE.contains(original.getStatus())) throw new ResponseStatusException(HttpStatus.CONFLICT,"orden original cerrada");
        var product=products.findById(productId).filter(com.sgologic.catalog.Product::isActive).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"producto no disponible"));
        PurchaseOrder replacement=new PurchaseOrder();
        replacement.setCustomerId(original.getCustomerId());replacement.setChannel(original.getChannel());
        replacement.setDeliveryAddress(original.getDeliveryAddress());replacement.setPickupLocationId(original.getPickupLocationId());
        BigDecimal price=pricing.unitPrice(product);replacement.setTotal(price.multiply(BigDecimal.valueOf(quantity)));
        replacement=orders.saveAndFlush(replacement);
        orderItems.save(new OrderItem(replacement.getId(),productId,quantity,price));
        incident.setReplacementOrderId(replacement.getId());
        updateStatus(id,IncidentStatus.RESOLVED);
        if(replacement.getPickupLocationId()==null) reservations.reserve(replacement.getId(),productId,quantity,settings.reservationTtlMinutes());
        else reservations.reserveAtLocation(replacement.getId(),productId,quantity,settings.reservationTtlMinutes(),replacement.getPickupLocationId());
        audit.record(AuditService.currentActor(),"CAMBIO_REEMPLAZO_CREADO","incident",id,original.getId(),original.getChannel(),Map.of("replacementOrderId",replacement.getId(),"productId",productId,"quantity",quantity));
        return replacement;
    }

    /** Quién hizo la operación: el usuario del token si inició sesión; si no, atención al cliente. */
    private static String actor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth instanceof AnonymousAuthenticationToken || auth.getName() == null) {
            return "atencion-al-cliente";
        }
        return auth.getName();
    }
}
