package com.sgologic.payments;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cobro de una orden (CDU-02).
 *
 * <p>El cuerpo no lleva el número de tarjeta ni el CVV: lleva el token que devuelve el
 * formulario de pago de PayKlik y los últimos 4 dígitos. Si aun así llega algo que parece un
 * número de tarjeta, se responde 400 y no se guarda nada (DC-08).
 */
@RestController
@RequestMapping("/api/orders/{orderId}/payments")
public class PaymentController {

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentService.PaymentOutcome pay(@PathVariable Long orderId, @Valid @RequestBody PayRequest body) {
        if (body.cardNumber() != null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "el backend no recibe el número de tarjeta: manda el token de PayKlik y los últimos 4 dígitos");
        }
        if (CardDataGuard.looksLikeCardNumber(body.cardToken())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "cardToken parece un número de tarjeta; debe ser el token de PayKlik");
        }

        PaymentMethod method = body.method() == null ? PaymentMethod.CARD : body.method();
        if (method == PaymentMethod.CARD && body.cardLast4() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "cardLast4 es obligatorio cuando el método es CARD");
        }
        return payments.pay(orderId, method, body.cardToken(), body.cardLast4());
    }

    /** El historial completo de intentos de cobro de la orden, exitosos y fallidos (DC-07). */
    @GetMapping
    public List<AttemptView> attempts(@PathVariable Long orderId) {
        return payments.attemptsOf(orderId).stream().map(AttemptView::of).toList();
    }

    public record PayRequest(
            PaymentMethod method,
            @NotBlank String cardToken,
            @Pattern(regexp = "^[0-9]{4}$", message = "deben ser exactamente 4 dígitos") String cardLast4,
            /** Solo existe para poder rechazarlo con un mensaje claro: aquí nunca entra un PAN. */
            String cardNumber) {
    }

    public record AttemptView(
            Long id,
            int attemptNumber,
            String result,
            BigDecimal amount,
            String providerReference,
            String cardLast4,
            String failureReason,
            Integer latencyMs,
            OffsetDateTime attemptedAt) {

        static AttemptView of(PaymentAttempt a) {
            return new AttemptView(
                    a.id(), a.attemptNumber(), a.result().code(), a.amount(), a.providerReference(),
                    a.cardLast4(), a.failureReason(), a.latencyMs(), a.attemptedAt());
        }
    }
}
