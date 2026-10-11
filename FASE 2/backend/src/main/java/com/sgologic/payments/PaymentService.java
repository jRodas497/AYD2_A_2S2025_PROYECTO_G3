package com.sgologic.payments;

import com.sgologic.audit.AuditService;
import com.sgologic.common.Channel;
import com.sgologic.common.CircuitBreaker;
import com.sgologic.config.SettingsService;
import com.sgologic.external.CircuitBreakers;
import com.sgologic.external.PayKlikClient;
import com.sgologic.external.Provider;
import com.sgologic.external.ProviderUnavailableException;
import com.sgologic.integration.EventTypes;
import com.sgologic.integration.OutboxService;
import com.sgologic.inventory.ReservationLifecycleService;
import com.sgologic.notifications.NotificationService;
import com.sgologic.orders.OrderStatus;
import com.sgologic.orders.PurchaseOrder;
import com.sgologic.orders.PurchaseOrderRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Procesa el cobro de una orden (CDU-02) con la estrategia del ADR-0002: outbox transaccional,
 * circuit breaker y cola de reintentos.
 *
 * <p>El cobro se hace en tres pasos separados a propósito:
 *
 * <ol>
 *   <li>una transacción corta que deja la orden en "pago en proceso" y lo registra;
 *   <li>la llamada a PayKlik, <em>fuera</em> de toda transacción, para no tener una conexión de
 *       base ocupada mientras un proveedor lento responde — si se hiciera dentro, 8x de demanda
 *       en Black Friday agotaría el pool de conexiones en vez de solo ir lento;
 *   <li>otra transacción corta que registra el intento y decide qué sigue.
 * </ol>
 *
 * <p>Como el paso 1 ya está confirmado antes de llamar a PayKlik, una caída del proveedor —o de
 * este mismo servicio— no puede perder la orden: queda en "pago en proceso" con su evento de
 * reintento en el outbox, que es exactamente lo que no pasó en el Black Friday anterior.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    @org.springframework.beans.factory.annotation.Autowired
    private CreditService credit;
    @org.springframework.beans.factory.annotation.Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private final PurchaseOrderRepository orders;
    private final PaymentAttemptRepository attempts;
    private final PayKlikClient payklik;
    private final CircuitBreakers breakers;
    private final ReservationLifecycleService reservations;
    private final OutboxService outbox;
    private final NotificationService notifications;
    private final AuditService audit;
    private final SettingsService settings;
    private final TransactionTemplate tx;

    public PaymentService(
            PurchaseOrderRepository orders,
            PaymentAttemptRepository attempts,
            PayKlikClient payklik,
            CircuitBreakers breakers,
            ReservationLifecycleService reservations,
            OutboxService outbox,
            NotificationService notifications,
            AuditService audit,
            SettingsService settings,
            TransactionTemplate tx) {
        this.orders = orders;
        this.attempts = attempts;
        this.payklik = payklik;
        this.breakers = breakers;
        this.reservations = reservations;
        this.outbox = outbox;
        this.notifications = notifications;
        this.audit = audit;
        this.settings = settings;
        this.tx = tx;
    }

    /** Cobro pedido por el cliente desde el checkout. */
    public PaymentOutcome pay(Long orderId, PaymentMethod method, String cardToken, String cardLast4) {
        if (method == PaymentMethod.CREDIT) {
            var candidate=orders.findById(orderId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"orden no encontrada"));
            credit.refreshHistory(candidate.getCustomerId());
            PaymentOutcome outcome=tx.execute(status -> {
                var requested=load(orderId);
                if(requested.getStatus()!=OrderStatus.PENDING_PAYMENT&&requested.getStatus()!=OrderStatus.PAYMENT_FAILED)
                    throw new ResponseStatusException(HttpStatus.CONFLICT,"la orden no admite una nueva solicitud de crédito");
                String rejected=credit.authorize(requested);
                if(rejected!=null)return new PaymentOutcome(orderId,0,"DECLINED",requested.getStatus().code(),null,0,rejected);
                OrderSnapshot snapshot = start(orderId, method, false);
                String reference = credit.purchase(load(orderId));
                return settle(snapshot, method, null, null, new ChargeOutcome(PaymentResult.APPROVED, reference, null, 0, false), false);
            });
            if(outcome.result().equals("DECLINED"))throw new ResponseStatusException(HttpStatus.CONFLICT,outcome.message());
            return outcome;
        }
        OrderSnapshot order = tx.execute(status -> {
            OrderSnapshot snapshot = start(orderId, method, false);
            if(jdbc!=null) jdbc.update("insert into payments.payment_intent(order_id,card_token,method) values(?,?,?) on conflict(order_id) do update set card_token=excluded.card_token,method=excluded.method,updated_at=now()",orderId,cardToken,method.name());
            Map<String,Object> intent = new HashMap<>();
            intent.put("orderId",orderId); intent.put("metodo",method.name());
            intent.put("cardToken",cardToken); intent.put("cardLast4",cardLast4);
            // Persist BEFORE calling PayKlik; a process crash cannot strand the payment.
            outbox.publishForOrder(orderId, EventTypes.PAYMENT_RETRY_REQUESTED, intent);
            return snapshot;
        });
        ChargeOutcome charge = charge(order, cardToken);
        return tx.execute(status -> settle(order, method, cardToken, cardLast4, charge, false));
    }

    /**
     * Reintento del cobro, disparado por el outbox cuando PayKlik no respondió. Si el cobro
     * vuelve a no resolverse, lanza: así el evento se queda en la cola y se reintenta con la
     * espera creciente, en vez de encolar un evento nuevo en cada vuelta.
     */
    public PaymentOutcome retry(Long orderId, PaymentMethod method, String cardToken, String cardLast4) {
        OrderSnapshot order = tx.execute(status -> {
            if(jdbc!=null) {
                var tokens=jdbc.queryForList("select card_token from payments.payment_intent where order_id=?",String.class,orderId);
                if(!tokens.isEmpty() && !java.util.Objects.equals(tokens.get(0),cardToken)) return null;
            }
            return start(orderId, method, true);
        });
        if (order == null) {
            return null; // la orden ya se había cobrado: el evento se da por atendido
        }
        ChargeOutcome charge = charge(order, cardToken);
        PaymentOutcome outcome = tx.execute(status -> settle(order, method, cardToken, cardLast4, charge, false));
        if (charge.queued()) {
            throw new ProviderUnavailableException(
                    Provider.PAYKLIK, charge.latencyMs(), charge.result() == PaymentResult.TIMEOUT,
                    charge.failureReason());
        }
        return outcome;
    }

    /**
     * Se agotaron los reintentos del cobro (CDU-02, E2): la orden queda en pago fallido,
     * auditada, y el cliente recibe el aviso para reintentar más tarde. La orden nunca
     * desaparece.
     */
    public void giveUp(Long orderId, String lastError) {
        tx.executeWithoutResult(status -> {
            PurchaseOrder order = load(orderId);
            if (order.getStatus() != OrderStatus.PAYMENT_IN_PROGRESS) {
                return;
            }
            reservations.releaseForOrder(orderId);
            order.setStatus(OrderStatus.PAYMENT_FAILED);
            order.setUpdatedAt(OffsetDateTime.now());
            audit.recordSystem("COBRO_AGOTADO", "order", orderId, orderId, order.getChannel(),
                    Map.of("motivo", String.valueOf(lastError)));
            notifications.queueForOrder(orderId,
                    "No pudimos procesar el pago de tu orden " + orderId + ". Puedes reintentarlo cuando quieras.");
        });
    }

    /** Paso 1: deja constancia de que hay un cobro en curso antes de hablar con el proveedor. */
    private OrderSnapshot start(Long orderId, PaymentMethod method, boolean isRetry) {
        PurchaseOrder order = load(orderId);
        OrderStatus status = order.getStatus();

        if (status == OrderStatus.PAID || status == OrderStatus.INVOICED
                || status == OrderStatus.IN_DISPATCH || status == OrderStatus.DELIVERED) {
            if (isRetry) {
                return null;
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "la orden " + orderId + " ya fue pagada");
        }
        if (isRetry && (status == OrderStatus.CANCELLED || status == OrderStatus.RETURNED)) return null;
        if (isRetry && status == OrderStatus.PAYMENT_FAILED && attempts.findByOrder(orderId).stream().anyMatch(a -> a.result()==PaymentResult.DECLINED)) return null;
        if (status == OrderStatus.CANCELLED || status == OrderStatus.RETURNED) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "la orden " + orderId + " está " + status.code() + " y no admite cobro");
        }
        if (status == OrderStatus.PAYMENT_IN_PROGRESS && !isRetry) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "la orden " + orderId + " ya tiene un cobro en proceso; consulta su estado antes de reintentar");
        }

        if(!isRetry && attempts.findByOrder(orderId).stream().filter(a -> a.result()==PaymentResult.DECLINED).count()>=3)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"se agotaron los tres intentos rechazados; cancela la orden y crea una nueva compra");
        // Reserve missing/expired items BEFORE charging; never approve a sale with no stock.
        reservations.ensureReservedForPayment(orderId, settings.reservationTtlMinutes());
        order.setStatus(OrderStatus.PAYMENT_IN_PROGRESS);
        order.setUpdatedAt(OffsetDateTime.now());
        audit.recordSystem(isRetry ? "COBRO_REINTENTADO" : "COBRO_INICIADO", "order", orderId, orderId,
                order.getChannel(), Map.of("metodo", method.name(), "monto", order.getTotal()));
        return new OrderSnapshot(order.getId(), order.getTotal(), order.getChannel());
    }

    /** Paso 2: la llamada al proveedor, protegida por el circuit breaker. Sin transacción abierta. */
    private ChargeOutcome charge(OrderSnapshot order, String cardToken) {
        CircuitBreaker breaker = breakers.of(Provider.PAYKLIK);
        if (!breaker.allowsRequest()) {
            // Degradación controlada (CDU-02, 2b): ni se intenta, se encola de una vez.
            return new ChargeOutcome(PaymentResult.ERROR, null,
                    "circuito abierto: PayKlik viene fallando, el cobro pasa a la cola de contingencia", 0, true);
        }

        long timeoutMs = settings.paymentTimeoutMs();
        try {
            PayKlikClient.ChargeResponse response = payklik.charge(order.id(), order.total(), cardToken, timeoutMs);
            breaker.recordSuccess();
            return response.approved()
                    ? new ChargeOutcome(PaymentResult.APPROVED, response.providerReference(), null,
                            response.latencyMs(), false)
                    : new ChargeOutcome(PaymentResult.DECLINED, response.providerReference(),
                            response.failureReason(), response.latencyMs(), false);
        } catch (ProviderUnavailableException e) {
            breaker.recordFailure();
            return new ChargeOutcome(
                    e.isTimeout() ? PaymentResult.TIMEOUT : PaymentResult.ERROR,
                    null, e.getMessage(), e.latencyMs(), true);
        }
    }

    /** Paso 3: registra el intento —salga como salga— y mueve la orden a donde corresponda. */
    private PaymentOutcome settle(
            OrderSnapshot snapshot, PaymentMethod method, String cardToken, String cardLast4,
            ChargeOutcome charge, boolean publishRetryEvent) {

        PurchaseOrder order = load(snapshot.id());
        if(order.getStatus()==OrderStatus.CANCELLED || order.getStatus()==OrderStatus.RETURNED)
            return new PaymentOutcome(snapshot.id(),0,charge.result().code(),order.getStatus().code(),charge.providerReference(),charge.latencyMs(),"la orden ya está cerrada");
        if (order.getStatus() == OrderStatus.PAID || order.getStatus() == OrderStatus.INVOICED
                || order.getStatus() == OrderStatus.IN_DISPATCH || order.getStatus() == OrderStatus.DELIVERED) {
            return new PaymentOutcome(snapshot.id(),0,"APPROVED",order.getStatus().code(),charge.providerReference(),charge.latencyMs(),"pago ya registrado");
        }
        int attemptNumber = attempts.nextAttemptNumber(snapshot.id());
        PaymentAttempt attempt = attempts.insert(
                snapshot.id(), attemptNumber, charge.result(), snapshot.total(),
                charge.providerReference(), cardLast4, charge.failureReason(), charge.latencyMs());

        Map<String, Object> details = new HashMap<>();
        details.put("metodo", method.name());
        details.put("intento", attemptNumber);
        details.put("resultado", charge.result().code());
        details.put("referencia", charge.providerReference());
        details.put("latenciaMs", charge.latencyMs());
        if (charge.failureReason() != null) {
            details.put("motivo", charge.failureReason());
        }

        String message;
        switch (charge.result()) {
            case APPROVED -> {
                reservations.ensureReservedForPayment(snapshot.id(), settings.reservationTtlMinutes());
                reservations.confirmForOrder(snapshot.id());
                order.setStatus(OrderStatus.PAID);
                outbox.publishForOrder(snapshot.id(), EventTypes.ORDER_PAID, Map.of("orderId", snapshot.id()));
                message = "cobro aprobado";
            }
            case DECLINED -> {
                reservations.releaseForOrder(snapshot.id());
                order.setStatus(OrderStatus.PAYMENT_FAILED);
                notifications.queueForOrder(snapshot.id(),
                        "Tu pago de la orden " + snapshot.id() + " fue rechazado: " + charge.failureReason());
                message = "cobro rechazado por el emisor: " + charge.failureReason();
            }
            default -> {
                // TIMEOUT o ERROR: la orden se queda en "pago en proceso", nunca se pierde.
                order.setStatus(OrderStatus.PAYMENT_IN_PROGRESS);
                if (publishRetryEvent) {
                    Map<String, Object> payload = new HashMap<>();
                    payload.put("orderId", snapshot.id());
                    payload.put("metodo", method.name());
                    payload.put("cardToken", cardToken);
                    payload.put("cardLast4", cardLast4);
                    outbox.publishForOrder(snapshot.id(), EventTypes.PAYMENT_RETRY_REQUESTED, payload);
                }
                message = "PayKlik no respondió; el cobro quedó en la cola de contingencia y se reintenta solo";
            }
        }
        order.setUpdatedAt(OffsetDateTime.now());
        audit.recordSystem("COBRO_" + charge.result().code(), "payment_attempt", attempt.id(),
                snapshot.id(), snapshot.channel(), details);

        log.info("orden {} intento {} -> {} ({} ms)", snapshot.id(), attemptNumber, charge.result(),
                charge.latencyMs());
        return new PaymentOutcome(
                snapshot.id(), attemptNumber, charge.result().code(), order.getStatus().code(),
                charge.providerReference(), charge.latencyMs(), message);
    }

    @org.springframework.transaction.annotation.Transactional
    public List<PaymentAttempt> attemptsOf(Long orderId) {
        load(orderId);
        return attempts.findByOrder(orderId);
    }

    private PurchaseOrder load(Long orderId) {
        return orders.findByIdForUpdate(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "orden no encontrada"));
    }

    /** Lo que necesita saber el cobro de la orden, sin arrastrar la entidad fuera de su transacción. */
    private record OrderSnapshot(Long id, BigDecimal total, Channel channel) {
    }

    /** Lo que devolvió (o no) PayKlik. {@code queued} = no hubo respuesta y hay que reintentar. */
    private record ChargeOutcome(
            PaymentResult result, String providerReference, String failureReason, long latencyMs, boolean queued) {
    }

    /** Lo que se le responde a quien pidió el cobro. */
    public record PaymentOutcome(
            Long orderId,
            int attemptNumber,
            String result,
            String orderStatus,
            String providerReference,
            long latencyMs,
            String message) {
    }
}
