package com.sgologic.inventory;

import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lo que le pasa a una reserva después del checkout: se confirma cuando el cobro se aprueba y
 * se consume cuando la mercancía sale hacia el cliente.
 *
 * <p>Separar "confirmar" de "consumir" importa: al confirmar, la reserva deja de vencer (el job
 * de {@link ReservationExpiryJob} solo toca las ACTIVE), pero las unidades siguen contadas en la
 * tienda porque todavía no han salido. Al despachar es cuando el inventario baja de verdad y
 * queda su movimiento de salida para poder cuadrarlo después.
 */
@Service
public class ReservationLifecycleService {

    private final JdbcTemplate jdbc;
    private final InventoryReservationService reservations;

    public ReservationLifecycleService(JdbcTemplate jdbc, InventoryReservationService reservations) {
        this.jdbc = jdbc;
        this.reservations = reservations;
    }

    /** Fija las reservas activas de la orden: ya no vencen. 1 = ACTIVE, 2 = CONFIRMED. */
    @Transactional
    public int confirmForOrder(Long orderId) {
        return jdbc.update(
                "update inventory.reservation set status_id = 2, closed_at = now() "
                        + "where order_id = ? and status_id = 1",
                orderId);
    }

    @Transactional
    public void releaseForOrder(Long orderId) {
        var lines=jdbc.queryForList("select id,location_id,product_id,quantity from inventory.reservation where order_id=? and status_id in (1,2) order by id for update",orderId);
        for(var line:lines) {
            jdbc.update("update inventory.stock set reserved=reserved-?,updated_at=now() where location_id=? and product_id=?",line.get("quantity"),line.get("location_id"),line.get("product_id"));
            jdbc.update("update inventory.reservation set status_id=3,closed_at=now() where id=?",line.get("id"));
        }
    }

    /** Las reservas confirmadas de la orden, con la ubicación donde está apartada la mercancía. */
    public List<ReservedLine> confirmedLines(Long orderId) {
        return jdbc.query(
                """
                select r.id, r.location_id, l.code as location_code, l.type_id, r.product_id, r.quantity
                from inventory.reservation r
                join inventory.location l on l.id = r.location_id
                where r.order_id = ? and r.status_id = 2
                order by r.id
                """,
                (rs, rowNum) -> new ReservedLine(
                        rs.getLong("id"),
                        rs.getLong("location_id"),
                        rs.getString("location_code"),
                        LocationType.fromId(rs.getShort("type_id")),
                        rs.getLong("product_id"),
                        rs.getInt("quantity")),
                orderId);
    }

    /**
     * Garantiza que la orden tenga reservada toda su mercancía antes de despachar. Normalmente
     * ya la tiene desde el checkout; hace falta cuando la reserva venció entre el checkout y el
     * cobro (por ejemplo, un cobro que estuvo en la cola de contingencia más de lo que dura la
     * reserva). Si ya no hay existencia, lanza {@link InsufficientStockException} y el despacho
     * queda pendiente en lugar de sacar mercancía que no existe.
     */
    @Transactional
    public List<ReservedLine> ensureReservedForDispatch(Long orderId, int ttlMinutes) {
        ensureReservedForPayment(orderId, ttlMinutes);
        confirmForOrder(orderId);
        return confirmedLines(orderId);
    }

    /** Keep unpaid reservations temporary, including while a provider or Kafka is unavailable. */
    @Transactional
    public void ensureReservedForPayment(Long orderId, int ttlMinutes) {
        jdbc.update("update inventory.reservation set expires_at=greatest(expires_at,now()+make_interval(mins=>?)) where order_id=? and status_id=1",ttlMinutes,orderId);
        Map<Long, Integer> reservedByProduct = confirmedLines(orderId).stream()
                .collect(java.util.stream.Collectors.toMap(
                        ReservedLine::productId, ReservedLine::quantity, Integer::sum));
        jdbc.query("select product_id, quantity from inventory.reservation where order_id=? and status_id=1",
                rs -> { reservedByProduct.merge(rs.getLong("product_id"), rs.getInt("quantity"), Integer::sum); }, orderId);

        List<long[]> ordered = jdbc.query(
                "select product_id, quantity from orders.order_item where order_id = ? order by product_id",
                (rs, rowNum) -> new long[] {rs.getLong("product_id"), rs.getInt("quantity")},
                orderId);

        for (long[] item : ordered) {
            long productId = item[0];
            int missing = (int) item[1] - reservedByProduct.getOrDefault(productId, 0);
            if (missing > 0) {
                Long pickup=jdbc.queryForObject("select pickup_location_id from orders.purchase_order where id=?",Long.class,orderId);
                if(pickup==null) reservations.reserve(orderId, productId, missing, ttlMinutes);
                else reservations.reserveAtLocation(orderId,productId,missing,ttlMinutes,pickup);
            }
        }
    }

    /** Transfer the reserved merchandise to the selected origin before a single shipment leaves. */
    @Transactional
    public List<ReservedLine> consolidate(Long orderId, Long originId, List<ReservedLine> lines) {
        for (ReservedLine line : lines) {
            if (line.locationId().equals(originId)) continue;
            int moved = jdbc.update("update inventory.stock set on_hand=on_hand-?,reserved=reserved-?,updated_at=now() where location_id=? and product_id=? and reserved>=? and on_hand>=?",
                    line.quantity(),line.quantity(),line.locationId(),line.productId(),line.quantity(),line.quantity());
            if(moved!=1) throw new IllegalStateException("no se pudo consolidar la reserva " + line.reservationId());
            jdbc.update("insert into inventory.stock(location_id,product_id,on_hand,reserved) values(?,?,?,?) on conflict(location_id,product_id) do update set on_hand=stock.on_hand+excluded.on_hand,reserved=stock.reserved+excluded.reserved,updated_at=now()",
                    originId,line.productId(),line.quantity(),line.quantity());
            recordMovement(line.locationId(),line.productId(),MovementType.OUT,line.quantity(),"Traslado al origen de despacho " + originId,orderId);
            recordMovement(originId,line.productId(),MovementType.IN,line.quantity(),"Recepción de traslado desde " + line.locationCode(),orderId);
            jdbc.update("update inventory.reservation set location_id=? where id=?",originId,line.reservationId());
        }
        return confirmedLines(orderId);
    }

    /**
     * Saca del inventario la mercancía ya reservada de la orden: baja las existencias del punto
     * de origen y deja el movimiento de salida. Solo se llama una vez por orden, dentro de la
     * misma transacción que crea el envío.
     */
    @Transactional
    public void consume(Long orderId, List<ReservedLine> lines) {
        for (ReservedLine line : lines) {
            jdbc.update(
                    """
                    update inventory.stock
                    set on_hand = on_hand - ?, reserved = reserved - ?, updated_at = now()
                    where location_id = ? and product_id = ?
                    """,
                    line.quantity(), line.quantity(), line.locationId(), line.productId());
            recordMovement(line.locationId(), line.productId(), MovementType.OUT, line.quantity(),
                    "Despacho de la orden " + orderId, orderId);
        }
    }

    /**
     * Cambia el punto de despacho de una orden ya preparada (CDU-04, flujo 1a): devuelve la
     * mercancía al origen anterior y la toma del nuevo. Si el nuevo origen no tiene existencia,
     * no se mueve nada.
     */
    @Transactional
    public List<ReservedLine> moveOrigin(Long orderId, Long newLocationId, List<ReservedLine> lines) {
        for (ReservedLine line : lines) {
            if (line.locationId().equals(newLocationId)) {
                continue;
            }
            jdbc.update(
                    "update inventory.stock set on_hand = on_hand + ?, updated_at = now() "
                            + "where location_id = ? and product_id = ?",
                    line.quantity(), line.locationId(), line.productId());
            recordMovement(line.locationId(), line.productId(), MovementType.IN, line.quantity(),
                    "Reasignación del despacho de la orden " + orderId, orderId);

            int taken = jdbc.update(
                    """
                    update inventory.stock
                    set on_hand = on_hand - ?, updated_at = now()
                    where location_id = ? and product_id = ? and on_hand - reserved >= ?
                    """,
                    line.quantity(), newLocationId, line.productId(), line.quantity());
            if (taken != 1) {
                // Revierte todo: la orden se queda despachándose desde donde ya estaba.
                throw new InsufficientStockException(line.productId(), line.quantity());
            }
            recordMovement(newLocationId, line.productId(), MovementType.OUT, line.quantity(),
                    "Reasignación del despacho de la orden " + orderId, orderId);

            jdbc.update("update inventory.reservation set location_id = ? where id = ?",
                    newLocationId, line.reservationId());
        }
        return confirmedLines(orderId);
    }

    private void recordMovement(Long locationId, Long productId, MovementType type, int quantity,
                                String reason, Long orderId) {
        jdbc.update(
                """
                insert into inventory.stock_movement (location_id, product_id, type_id, quantity, reason, order_id)
                values (?, ?, ?, ?, ?, ?)
                """,
                locationId, productId, type.id(), quantity, reason, orderId);
    }

    /** Una línea de mercancía apartada para la orden, en una ubicación concreta. */
    public record ReservedLine(
            Long reservationId,
            Long locationId,
            String locationCode,
            LocationType locationType,
            Long productId,
            int quantity) {
    }
}
