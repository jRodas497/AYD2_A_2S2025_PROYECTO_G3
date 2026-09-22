package com.sgologic.web;

import com.sgologic.inventory.InsufficientStockException;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiError> onInsufficientStock(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(ex.getMessage()));
    }

    public record ApiError(String message, OffsetDateTime timestamp) {
        ApiError(String message) {
            this(message, OffsetDateTime.now());
        }
    }
}
