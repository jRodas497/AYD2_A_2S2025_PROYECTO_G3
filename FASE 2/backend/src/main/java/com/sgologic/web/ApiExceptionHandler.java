package com.sgologic.web;

import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.inventory.InsufficientStockException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Mismo formato de error que ya trae Spring por defecto en un 404/400 normal
 * (ver "server.error.include-message" en application.yml), para que el 409 de
 * sin-stock no sea la excepción que rompe el contrato con el frontend.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiError> onInsufficientStock(InsufficientStockException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(HttpStatus.CONFLICT, ex.getMessage(), request.getRequestURI()));
    }

    /**
     * Un tercero (PayKlik, la SAT, LogiExpress) no respondió. Se responde 503 y no 500: no es un
     * error de SGO-Logic, y la operación ya quedó encolada para reintentarse sola.
     */
    @ExceptionHandler(ProviderUnavailableException.class)
    public ResponseEntity<ApiError> onProviderUnavailable(
            ProviderUnavailableException ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new ApiError(HttpStatus.SERVICE_UNAVAILABLE, ex.getMessage(), request.getRequestURI()));
    }

    /**
     * Una regla de la base rechazó el dato (llave única, llave foránea, check). Sin esto salía un
     * 500 con la sentencia SQL completa en el mensaje: un error del cliente reportado como falla
     * del servidor, y además exponiendo el esquema. Se responde 409 con un mensaje legible.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> onIntegrityViolation(
            DataIntegrityViolationException ex, HttpServletRequest request) {
        String detail = String.valueOf(ex.getMostSpecificCause().getMessage());
        String message;
        if (detail.contains("customer_email_key")) {
            message = "ya existe un cliente con ese correo";
        } else if (detail.contains("no_card_number")) {
            message = "el dato contiene algo que parece un número de tarjeta y no se puede guardar";
        } else {
            message = "la operación viola una regla de integridad de los datos";
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiError(HttpStatus.CONFLICT, message, request.getRequestURI()));
    }

    public record ApiError(OffsetDateTime timestamp, int status, String error, String message, String path) {
        ApiError(HttpStatus status, String message, String path) {
            this(OffsetDateTime.now(), status.value(), status.getReasonPhrase(), message, path);
        }
    }
}
