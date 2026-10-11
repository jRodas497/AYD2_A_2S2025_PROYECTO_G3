package com.sgologic.inventory;

import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reserva y libera stock. La atomicidad no depende de Java: el UPDATE de abajo solo afecta
 * una fila si todavía hay existencia suficiente, así que dos compras simultáneas no pueden
 * las dos reservar la última unidad (lo mismo que hace cumplir el check "reserved <= on_hand"
 * en la base, ver V1__esquemas_y_tablas.sql).
 */
@Service
public class InventoryReservationService {

    private final JdbcTemplate jdbc;
    private final ReservationRepository reservations;

    public InventoryReservationService(JdbcTemplate jdbc, ReservationRepository reservations) {
        this.jdbc = jdbc;
        this.reservations = reservations;
    }

    /**
     * Reserva {@code quantity} unidades de {@code productId} para la orden {@code orderId},
     * eligiendo una ubicación con existencia (centros de distribución primero). No decide el
     * punto de despacho final: esa es una decisión de Logistics Service, más adelante.
     */
    @Transactional
    public Reservation reserve(Long orderId, Long productId, int quantity, int ttlMinutes) {
        List<java.util.Map<String,Object>> candidates = jdbc.queryForList(
                """
                select s.location_id,s.on_hand-s.reserved as available
                from inventory.stock s
                join inventory.location l on l.id = s.location_id
                where s.product_id = ? and s.on_hand - s.reserved > 0
                order by l.type_id asc, s.location_id asc
                for update of s
                """,
                productId);

        if(candidates.stream().mapToLong(c->((Number)c.get("available")).longValue()).sum()<quantity)
            throw new InsufficientStockException(productId,quantity);
        int remaining=quantity;
        Reservation first=null;
        for (var candidate : candidates) {
            Long locationId=((Number)candidate.get("location_id")).longValue();
            int taken=Math.min(remaining,((Number)candidate.get("available")).intValue());
            if(taken==0)continue;
            int updated = jdbc.update(
                    """
                    update inventory.stock
                    set reserved = reserved + ?, updated_at = now()
                    where location_id = ? and product_id = ? and on_hand - reserved >= ?
                    """,
                    taken, locationId, productId, taken);
            if (updated == 1) {
                Reservation r = new Reservation();
                r.setOrderId(orderId);
                r.setLocationId(locationId);
                r.setProductId(productId);
                r.setQuantity(taken);
                r.setStatus(ReservationStatus.ACTIVE);
                r.setExpiresAt(OffsetDateTime.now().plusMinutes(ttlMinutes));
                Reservation saved=reservations.save(r);
                if(first==null)first=saved;
                remaining-=taken;
                if(remaining==0)return first;
            }
            // otra transacción se adelantó entre el select y el update: probar el siguiente candidato.
        }
        throw new InsufficientStockException(productId, quantity);
    }

    @Transactional
    public Reservation reserveAtLocation(Long orderId,Long productId,int quantity,int ttlMinutes,Long locationId) {
        int changed=jdbc.update("update inventory.stock set reserved=reserved+?,updated_at=now() where location_id=? and product_id=? and on_hand-reserved>=?",quantity,locationId,productId,quantity);
        if(changed!=1) throw new InsufficientStockException(productId,quantity);
        Reservation r=new Reservation();r.setOrderId(orderId);r.setProductId(productId);r.setLocationId(locationId);r.setQuantity(quantity);r.setStatus(ReservationStatus.ACTIVE);r.setExpiresAt(OffsetDateTime.now().plusMinutes(ttlMinutes));
        return reservations.save(r);
    }

    /** Libera las reservas activas ya vencidas: baja el stock reservado y las marca EXPIRED. */
    @Transactional
    public int releaseExpired() {
        List<Reservation> expired =
                reservations.findExpiredLocked();
        for (Reservation r : expired) {
            jdbc.update(
                    "update inventory.stock set reserved = reserved - ?, updated_at = now() "
                            + "where location_id = ? and product_id = ?",
                    r.getQuantity(), r.getLocationId(), r.getProductId());
            r.setStatus(ReservationStatus.EXPIRED);
            r.setClosedAt(OffsetDateTime.now());
        }
        reservations.saveAll(expired);
        return expired.size();
    }
}
