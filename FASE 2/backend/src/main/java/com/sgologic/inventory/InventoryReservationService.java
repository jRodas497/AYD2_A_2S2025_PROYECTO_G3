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

    private static final int MAX_LOCATION_CANDIDATES = 5;

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
        List<Long> candidates = jdbc.queryForList(
                """
                select s.location_id
                from inventory.stock s
                join inventory.location l on l.id = s.location_id
                where s.product_id = ? and s.on_hand - s.reserved >= ?
                order by l.type_id asc, s.location_id asc
                limit ?
                """,
                Long.class, productId, quantity, MAX_LOCATION_CANDIDATES);

        for (Long locationId : candidates) {
            int updated = jdbc.update(
                    """
                    update inventory.stock
                    set reserved = reserved + ?, updated_at = now()
                    where location_id = ? and product_id = ? and on_hand - reserved >= ?
                    """,
                    quantity, locationId, productId, quantity);
            if (updated == 1) {
                Reservation r = new Reservation();
                r.setOrderId(orderId);
                r.setLocationId(locationId);
                r.setProductId(productId);
                r.setQuantity(quantity);
                r.setStatus(ReservationStatus.ACTIVE);
                r.setExpiresAt(OffsetDateTime.now().plusMinutes(ttlMinutes));
                return reservations.save(r);
            }
            // otra transacción se adelantó entre el select y el update: probar el siguiente candidato.
        }
        throw new InsufficientStockException(productId, quantity);
    }

    /** Libera las reservas activas ya vencidas: baja el stock reservado y las marca EXPIRED. */
    @Transactional
    public int releaseExpired() {
        List<Reservation> expired =
                reservations.findByStatusAndExpiresAtBefore(ReservationStatus.ACTIVE, OffsetDateTime.now());
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
