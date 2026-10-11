package com.sgologic.orders;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select o from PurchaseOrder o where o.id=:id")
    java.util.Optional<PurchaseOrder> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
