package com.sgologic.notifications;

import com.sgologic.common.DeliveryStatus;
import java.util.List;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByOrderIdOrderByIdAsc(Long orderId);

    List<Notification> findByStatusOrderByIdAsc(DeliveryStatus status, Limit limit);
}
