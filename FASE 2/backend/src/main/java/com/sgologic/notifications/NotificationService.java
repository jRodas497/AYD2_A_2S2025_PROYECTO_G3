package com.sgologic.notifications;

import com.sgologic.common.DeliveryStatus;
import com.sgologic.external.MessagingClient;
import com.sgologic.external.ProviderUnavailableException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Limit;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Avisos al cliente (SMS, correo, push). Es el único integrado en modo "best effort"
 * (ADR-0004): encolar el aviso es parte de la transacción del hecho que lo origina, pero
 * <em>enviarlo</em> ocurre después, en un hilo aparte. Por eso una caída del proveedor de
 * mensajería no puede impedir confirmar, pagar, facturar ni despachar una orden — como mucho,
 * deja un aviso en FAILED que se puede reintentar a mano.
 */
@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notifications;
    private final MessagingClient messaging;
    private final JdbcTemplate jdbc;

    public NotificationService(
            NotificationRepository notifications, MessagingClient messaging, JdbcTemplate jdbc) {
        this.notifications = notifications;
        this.messaging = messaging;
        this.jdbc = jdbc;
    }

    /**
     * Deja encolado un aviso sobre una orden. Elige el canal según el dato de contacto que el
     * cliente tenga registrado: correo si lo hay, si no SMS, y push como último recurso.
     */
    @Transactional
    public Optional<Notification> queueForOrder(Long orderId, String message) {
        Contact contact = contactOf(orderId);
        if (contact == null) {
            log.warn("la orden {} no tiene destinatario para avisarle", orderId);
            return Optional.empty();
        }

        Notification notification = new Notification();
        notification.setOrderId(orderId);
        notification.setChannel(contact.channel());
        notification.setRecipient(contact.recipient());
        notification.setMessage(message);
        return Optional.of(notifications.save(notification));
    }

    @Transactional
    public void deliverOne(Long id) {
        Notification n = notifications.findById(id).orElseThrow();
        if (n.getStatus() != DeliveryStatus.PENDING) return;
        n.setAttempts(n.getAttempts() + 1);
        String rejection = messaging.send(n.getChannel().code(), n.getRecipient(), n.getMessage());
        if (rejection != null) throw new IllegalStateException(rejection);
        n.setStatus(DeliveryStatus.DELIVERED);
        n.setSentAt(OffsetDateTime.now());
        n.setLastError(null);
    }

    /** Vuelve a poner en cola un aviso que se dio por perdido. */
    @Transactional
    public Notification retry(Long notificationId) {
        Notification notification = notifications.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("aviso no encontrado: " + notificationId));
        if(notification.getStatus()!=DeliveryStatus.FAILED) return notification;
        notification.setStatus(DeliveryStatus.PENDING);
        notification.setAttempts(0);
        notification.setLastError(null);
        jdbc.update("update notifications.notification set kafka_published_at=null, relay_lease_until=null where id=?", notificationId);
        return notification;
    }

    public List<Notification> ofOrder(Long orderId) {
        return notifications.findByOrderIdOrderByIdAsc(orderId);
    }

    public List<Notification> byStatus(DeliveryStatus status, int limit) {
        return notifications.findByStatusOrderByIdAsc(status, Limit.of(limit));
    }

    private Contact contactOf(Long orderId) {
        List<Contact> found = jdbc.query(
                """
                select c.id, c.email, c.phone
                from orders.purchase_order o
                join customers.customer c on c.id = o.customer_id
                where o.id = ?
                """,
                (rs, rowNum) -> {
                    String email = rs.getString("email");
                    String phone = rs.getString("phone");
                    if (email != null && !email.isBlank()) {
                        return new Contact(NotificationChannel.EMAIL, email);
                    }
                    if (phone != null && !phone.isBlank()) {
                        return new Contact(NotificationChannel.SMS, phone);
                    }
                    return new Contact(NotificationChannel.PUSH, "cliente-" + rs.getLong("id"));
                },
                orderId);
        return found.isEmpty() ? null : found.get(0);
    }

    private record Contact(NotificationChannel channel, String recipient) {
    }
}
