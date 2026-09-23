package com.sgologic.logistics;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

    Optional<Shipment> findFirstByOrderIdOrderByIdDesc(Long orderId);

    List<Shipment> findByStatusOrderByIdDesc(ShipmentStatus status, Limit limit);
}
