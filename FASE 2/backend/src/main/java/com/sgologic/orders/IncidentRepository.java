package com.sgologic.orders;

import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByOrderId(Long orderId);

    @Query("""
            select i from Incident i
            where i.orderId in (select o.id from PurchaseOrder o where o.customerId = :customerId)
            order by i.createdAt desc
            """)
    List<Incident> findByCustomer(@Param("customerId") Long customerId, Pageable page);
}
