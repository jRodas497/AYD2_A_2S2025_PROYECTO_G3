package com.sgologic.inventory;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(Long productId, int quantity) {
        super("no hay existencia suficiente del producto " + productId + " para reservar " + quantity + " unidad(es)");
    }
}
