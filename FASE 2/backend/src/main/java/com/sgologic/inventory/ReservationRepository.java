package com.sgologic.inventory;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    List<Reservation> findByStatusAndExpiresAtBefore(ReservationStatus status, OffsetDateTime instant);

    List<Reservation> findByOrderId(Long orderId);
}
