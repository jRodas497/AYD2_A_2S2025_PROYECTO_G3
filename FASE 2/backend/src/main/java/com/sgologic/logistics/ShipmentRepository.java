package com.sgologic.logistics;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from Shipment s where s.id=:id")
    Optional<Shipment> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    Optional<Shipment> findFirstByOrderIdOrderByIdDesc(Long orderId);

    List<Shipment> findByStatusOrderByIdDesc(ShipmentStatus status, Limit limit);
}
