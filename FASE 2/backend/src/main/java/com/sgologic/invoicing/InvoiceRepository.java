package com.sgologic.invoicing;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByOrderId(Long orderId);

    List<Invoice> findByStatusOrderByIdDesc(InvoiceStatus status, Limit limit);
}
