package com.sgologic.inventory;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {
    @org.springframework.data.jpa.repository.Query(value="select * from inventory.reservation where status_id=1 and expires_at<now() order by id for update skip locked",nativeQuery=true)
    List<Reservation> findExpiredLocked();
    List<Reservation> findByStatusAndExpiresAtBefore(ReservationStatus status, OffsetDateTime instant);

    List<Reservation> findByOrderId(Long orderId);
}
