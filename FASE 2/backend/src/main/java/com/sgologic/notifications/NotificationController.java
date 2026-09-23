package com.sgologic.notifications;

import com.sgologic.common.DeliveryStatus;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Consulta y reintento de los avisos al cliente. */
@RestController
@RequestMapping("/api")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    /** Los avisos que se le mandaron al cliente por esta orden, en orden de creación. */
    @GetMapping("/orders/{orderId}/notifications")
    public List<NotificationView> ofOrder(@PathVariable Long orderId) {
        return notifications.ofOrder(orderId).stream().map(NotificationView::of).toList();
    }

    /** Los avisos por estado. Con {@code status=FAILED} es la lista de los que nadie recibió. */
    @GetMapping("/notifications")
    public List<NotificationView> byStatus(
            @RequestParam(defaultValue = "PENDING") String status,
            @RequestParam(defaultValue = "50") int limit) {
        return notifications.byStatus(parse(status), limit).stream().map(NotificationView::of).toList();
    }

    @PostMapping("/notifications/{id}/retry")
    public NotificationView retry(@PathVariable Long id) {
        try {
            return NotificationView.of(notifications.retry(id));
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "aviso no encontrado");
        }
    }

    private static DeliveryStatus parse(String status) {
        try {
            return DeliveryStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "estado desconocido: " + status + " (PENDING, DELIVERED, FAILED)");
        }
    }

    public record NotificationView(
            Long id,
            Long orderId,
            String channel,
            String status,
            String recipient,
            String message,
            int attempts,
            String lastError,
            OffsetDateTime createdAt,
            OffsetDateTime sentAt) {

        static NotificationView of(Notification n) {
            return new NotificationView(
                    n.getId(), n.getOrderId(), n.getChannel().code(), n.getStatus().code(),
                    n.getRecipient(), n.getMessage(), n.getAttempts(), n.getLastError(),
                    n.getCreatedAt(), n.getSentAt());
        }
    }
}
