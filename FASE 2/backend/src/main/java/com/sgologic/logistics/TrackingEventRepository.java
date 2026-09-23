package com.sgologic.logistics;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TrackingEventRepository extends JpaRepository<TrackingEvent, Long> {

    List<TrackingEvent> findByShipmentIdOrderByIdAsc(Long shipmentId);
}
