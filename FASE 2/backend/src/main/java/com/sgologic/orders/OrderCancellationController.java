package com.sgologic.orders;
import com.sgologic.inventory.ReservationLifecycleService;
import com.sgologic.audit.AuditService;
import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class OrderCancellationController {
    private final PurchaseOrderRepository orders;
    private final ReservationLifecycleService reservations;
    private final AuditService audit;
    public OrderCancellationController(PurchaseOrderRepository orders,ReservationLifecycleService reservations,AuditService audit) {
        this.orders=orders;this.reservations=reservations;this.audit=audit;
    }
    @PostMapping("/api/orders/{id}/cancel")
    @Transactional
    public Map<String,Object> cancel(@PathVariable Long id) {
        var order=orders.findByIdForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"orden no encontrada"));
        if(order.getStatus()==OrderStatus.CANCELLED) return Map.of("id",id,"status","CANCELLED");
        if(order.getStatus()!=OrderStatus.PENDING_PAYMENT && order.getStatus()!=OrderStatus.PAYMENT_FAILED)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"solo se cancelan órdenes sin pago confirmado o en proceso");
        reservations.releaseForOrder(id);
        order.setStatus(OrderStatus.CANCELLED);order.setUpdatedAt(OffsetDateTime.now());
        audit.recordSystem("ORDEN_CANCELADA","order",id,id,order.getChannel(),Map.of());
        return Map.of("id",id,"status","CANCELLED");
    }
}
