package com.sgologic.notifications;

import com.sgologic.common.DeliveryStatus;
import com.sgologic.common.DeliveryStatusConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Un aviso al cliente. Guarda el destinatario tal como se usó al enviarlo: si después el
 * cliente cambia de correo, el registro del aviso no cambia.
 */
@Entity
@Table(name = "notification", schema = "notifications")
@Getter
@Setter
@NoArgsConstructor
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(name = "channel_id", nullable = false)
    @Convert(converter = NotificationChannelConverter.class)
    private NotificationChannel channel;

    @Column(name = "status_id", nullable = false)
    @Convert(converter = DeliveryStatusConverter.class)
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Column(nullable = false)
    private String recipient;

    @Column(nullable = false)
    private String message;

    @Column(nullable = false)
    private Integer attempts = 0;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "created_at", insertable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "sent_at")
    private OffsetDateTime sentAt;
}
