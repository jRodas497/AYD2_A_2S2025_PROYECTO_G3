package com.sgologic.inventory;

import com.sgologic.audit.AuditService;
import com.sgologic.integration.pos.PosEventService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Actualizar inventario (CDU expandido Gestión de Inventario): registrar una entrada de mercancía
 * (reposición, compra a proveedor, devolución física) o una salida manual (merma, ajuste) en un
 * centro o una tienda.
 *
 * <p>Tres cosas pasan juntas, en una transacción: cambia la existencia, queda el movimiento para
 * poder cuadrarla, y si la ubicación es una tienda se le encola el evento a su POS para que las 32
 * tiendas queden coherentes. Una salida nunca toca unidades ya reservadas: solo puede sacar lo
 * disponible ({@code on_hand - reserved}).
 */
@RestController
@RequestMapping("/api/inventory")
public class StockMovementController {

    private final JdbcTemplate jdbc;
    private final PosEventService posEvents;
    private final AuditService audit;
    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.auth.StoreAccess storeAccess;

    public StockMovementController(JdbcTemplate jdbc, PosEventService posEvents, AuditService audit) {
        this.jdbc = jdbc;
        this.posEvents = posEvents;
        this.audit = audit;
    }

    @PostMapping("/movements")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Movement register(@Valid @RequestBody NewMovement body) {
        storeAccess.requireLocation(body.locationCode());
        List<Map<String, Object>> location = jdbc.queryForList(
                "select id, type_id from inventory.location where code = ? and active for share", body.locationCode());
        if (location.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ubicación no encontrada: " + body.locationCode());
        }
        Long locationId = ((Number) location.get(0).get("id")).longValue();
        LocationType locationType = LocationType.fromId(((Number) location.get(0).get("type_id")).shortValue());
        Integer active = jdbc.queryForObject(
                "select count(*) from catalog.product where id = ? and active", Integer.class, body.productId());
        if (active == null || active == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "producto no encontrado o inactivo");
        }

        if (body.type() == MovementType.IN) {
            // Si la ubicación nunca tuvo este producto, la fila de existencia se crea aquí.
            jdbc.update(
                    """
                    insert into inventory.stock (location_id, product_id, on_hand)
                    values (?, ?, ?)
                    on conflict (location_id, product_id)
                    do update set on_hand = stock.on_hand + excluded.on_hand, updated_at = now()
                    """,
                    locationId, body.productId(), body.quantity());
        } else {
            int updated = jdbc.update(
                    """
                    update inventory.stock set on_hand = on_hand - ?, updated_at = now()
                    where location_id = ? and product_id = ? and on_hand - reserved >= ?
                    """,
                    body.quantity(), locationId, body.productId(), body.quantity());
            if (updated != 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "no hay " + body.quantity() + " unidad(es) disponibles de ese producto en "
                                + body.locationCode() + " (las reservadas no se pueden sacar)");
            }
        }

        Long movementId = jdbc.queryForObject(
                """
                insert into inventory.stock_movement (location_id, product_id, type_id, quantity, reason)
                values (?, ?, ?, ?, ?)
                returning id
                """,
                Long.class, locationId, body.productId(), body.type().id(), body.quantity(), body.reason());

        if (locationType == LocationType.STORE) {
            posEvents.publish(locationId, PosEventService.STOCK_ADJUSTED,
                    Map.of("productId", body.productId(), "movimiento", body.type().code(),
                           "quantity", body.quantity(), "motivo", body.reason()));
        }
        audit.record(AuditService.currentActor(), "INVENTARIO_" + (body.type() == MovementType.IN ? "ENTRADA" : "SALIDA"),
                "stock_movement", movementId, null, null,
                Map.of("ubicacion", body.locationCode(), "productId", body.productId(),
                       "cantidad", body.quantity(), "motivo", body.reason()));

        return movements(body.productId(), 1).get(0);
    }

    /**
     * Ajuste por conteo físico que reporta el POS de una tienda (CDU-08, E2): el conteo se acepta
     * como la fuente de verdad más reciente de esa tienda. La diferencia contra lo registrado se
     * guarda como movimiento de entrada o salida y queda en la auditoría como diferencia de
     * inventario, que es lo que se revisa después.
     *
     * <p>Lo único que no se acepta es un conteo menor a lo que ya está reservado para órdenes: esas
     * unidades están comprometidas con clientes, y bajarlas rompería la regla de no sobreventa. En
     * ese caso se responde 409 y el intento también queda auditado.
     */
    @PostMapping("/adjustments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Adjustment adjust(@Valid @RequestBody NewAdjustment body) {
        storeAccess.requireLocation(body.locationCode());
        List<Map<String, Object>> location = jdbc.queryForList(
                "select id, type_id from inventory.location where code = ? and active for share", body.locationCode());
        if (location.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ubicación no encontrada: " + body.locationCode());
        }
        Long locationId = ((Number) location.get(0).get("id")).longValue();
        LocationType locationType = LocationType.fromId(((Number) location.get(0).get("type_id")).shortValue());

        List<Map<String, Object>> stock = jdbc.queryForList(
                "select on_hand, reserved from inventory.stock where location_id = ? and product_id = ? for update",
                locationId, body.productId());
        int before = stock.isEmpty() ? 0 : ((Number) stock.get(0).get("on_hand")).intValue();
        int reserved = stock.isEmpty() ? 0 : ((Number) stock.get(0).get("reserved")).intValue();
        int difference = body.countedQuantity() - before;
        String source = body.source() == null || body.source().isBlank() ? "POS " + body.locationCode() : body.source();

        if (body.countedQuantity() < reserved) {
            audit.record(AuditService.currentActor(), "INVENTARIO_AJUSTE_RECHAZADO", "stock", body.locationCode() + ":" + body.productId(),
                    null, null, Map.of("registrado", before, "contado", body.countedQuantity(), "reservado", reserved,"fuente",source));
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "el conteo (" + body.countedQuantity() + ") es menor a lo reservado para órdenes (" + reserved
                            + "); revisar antes de ajustar");
        }

        if (difference != 0) {
            MovementType type = difference > 0 ? MovementType.IN : MovementType.OUT;
            jdbc.update(
                    """
                    insert into inventory.stock (location_id, product_id, on_hand)
                    values (?, ?, ?)
                    on conflict (location_id, product_id) do update set on_hand = excluded.on_hand, updated_at = now()
                    """,
                    locationId, body.productId(), body.countedQuantity());
            jdbc.update(
                    """
                    insert into inventory.stock_movement (location_id, product_id, type_id, quantity, reason)
                    values (?, ?, ?, ?, ?)
                    """,
                    locationId, body.productId(), type.id(), Math.abs(difference),
                    "Ajuste por conteo físico (" + source + ")");
            if (locationType == LocationType.STORE) {
                posEvents.publish(locationId, PosEventService.STOCK_ADJUSTED,
                        Map.of("productId", body.productId(), "movimiento", "AJUSTE",
                               "quantity", body.countedQuantity(), "motivo", "conteo físico aceptado"));
            }
        }
        audit.record(AuditService.currentActor(), "INVENTARIO_AJUSTE", "stock", body.locationCode() + ":" + body.productId(), null, null,
                Map.of("registrado", before, "contado", body.countedQuantity(), "diferencia", difference,"fuente",source));
        return new Adjustment(body.locationCode(), body.productId(), before, body.countedQuantity(), difference, reserved);
    }

    /** Los últimos movimientos de un producto, en todas las ubicaciones. */
    @GetMapping("/products/{productId}/movements")
    public List<Movement> movements(@PathVariable Long productId, @RequestParam(defaultValue = "50") int limit) {
        return jdbc.query(
                """
                select m.id, l.code, m.product_id, t.code as type, m.quantity, m.reason, m.order_id, m.created_at,
                       s.on_hand, s.reserved
                from inventory.stock_movement m
                join inventory.location l on l.id = m.location_id
                join inventory.movement_type t on t.id = m.type_id
                join inventory.stock s on s.location_id = m.location_id and s.product_id = m.product_id
                where m.product_id = ?
                order by m.id desc
                limit ?
                """,
                (rs, rowNum) -> new Movement(
                        rs.getLong("id"), rs.getString("code"), rs.getLong("product_id"), rs.getString("type"),
                        rs.getInt("quantity"), rs.getString("reason"), (Long) rs.getObject("order_id"),
                        rs.getObject("created_at", OffsetDateTime.class), rs.getInt("on_hand"), rs.getInt("reserved")),
                productId, limit);
    }

    public record NewMovement(
            @NotBlank String locationCode,
            @NotNull Long productId,
            @NotNull MovementType type,
            @NotNull @Min(1) Integer quantity,
            @NotBlank String reason) {
    }

    /** {@code source} es quién reporta el conteo (por defecto, "POS" más el código de la tienda). */
    public record NewAdjustment(
            @NotBlank String locationCode,
            @NotNull Long productId,
            @NotNull @Min(0) Integer countedQuantity,
            String source) {
    }

    /** El resultado del ajuste: lo que había registrado, lo que se contó y la diferencia aplicada. */
    public record Adjustment(
            String locationCode, Long productId, int registered, int counted, int difference, int reserved) {
    }

    /** Un movimiento, con la existencia de esa ubicación tal como está ahora. */
    public record Movement(
            Long id, String locationCode, Long productId, String type, int quantity, String reason,
            Long orderId, OffsetDateTime createdAt, int onHandNow, int reservedNow) {
    }
}
