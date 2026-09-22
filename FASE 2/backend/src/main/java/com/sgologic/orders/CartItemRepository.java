package com.sgologic.orders;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemRepository extends JpaRepository<CartItem, CartItemId> {
    List<CartItem> findById_Cart(Long cartId);
}
