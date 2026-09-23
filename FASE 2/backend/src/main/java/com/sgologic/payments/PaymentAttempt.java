package com.sgologic.payments;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * Un intento de cobro. La tabla es de solo inserción (la base rechaza UPDATE y DELETE, y al
 * rol de la aplicación ni siquiera se le dio el permiso), así que esto es un registro de
 * lectura, no una entidad que se modifique.
 */
public record PaymentAttempt(
        Long id,
        Long orderId,
        int attemptNumber,
        PaymentResult result,
        BigDecimal amount,
        String providerReference,
        String cardLast4,
        String failureReason,
        Integer latencyMs,
        OffsetDateTime attemptedAt) {
}
