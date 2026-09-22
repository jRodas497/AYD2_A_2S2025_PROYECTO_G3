package com.sgologic.orders;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartRepository extends JpaRepository<Cart, Long> {
    Optional<Cart> findByCustomerIdAndStatusIn(Long customerId, java.util.List<CartStatus> statuses);
}
