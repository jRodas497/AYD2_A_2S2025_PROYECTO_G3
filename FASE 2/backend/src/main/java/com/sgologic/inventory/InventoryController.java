package com.sgologic.inventory;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** RF03: vista unificada de existencias, consolidando los 2 centros de distribución y las 32 tiendas. */
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {

    private final JdbcTemplate jdbc;

    public InventoryController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/products/{productId}/availability")
    public Availability availability(@PathVariable Long productId) {
        List<LocationAvailability> byLocation = jdbc.query(
                """
                select l.code, l.name, s.on_hand - s.reserved as available
                from inventory.stock s
                join inventory.location l on l.id = s.location_id
                where s.product_id = ?
                order by available desc
                """,
                (rs, rowNum) -> new LocationAvailability(
                        rs.getString("code"), rs.getString("name"), rs.getInt("available")),
                productId);

        int total = byLocation.stream().mapToInt(LocationAvailability::available).sum();
        return new Availability(productId, total, byLocation);
    }

    /**
     * Pantalla de Reservas de stock (PB-006): las reservas activas y las que ya se liberaron por
     * expiración, con el producto y la ubicación resueltos para no tener que cruzarlos a mano.
     */
    @GetMapping("/reservations")
    public List<ReservationView> reservations(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long productId,
            @RequestParam(defaultValue = "50") int limit) {
        StringBuilder sql = new StringBuilder(
                """
                select r.id, r.order_id, r.product_id, p.sku, p.name as product_name, l.code as location_code,
                       r.quantity, rs.code as status, r.created_at, r.expires_at, r.closed_at
                from inventory.reservation r
                join catalog.product p on p.id = r.product_id
                join inventory.location l on l.id = r.location_id
                join inventory.reservation_status rs on rs.id = r.status_id
                where 1 = 1
                """);
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            sql.append(" and rs.code = ?");
            args.add(status.trim().toUpperCase());
        }
        if (productId != null) {
            sql.append(" and r.product_id = ?");
            args.add(productId);
        }
        sql.append(" order by r.id desc limit ?");
        args.add(limit);
        return jdbc.query(
                sql.toString(),
                (rs, rowNum) -> new ReservationView(
                        rs.getLong("id"),
                        rs.getLong("order_id"),
                        rs.getLong("product_id"),
                        rs.getString("sku"),
                        rs.getString("product_name"),
                        rs.getString("location_code"),
                        rs.getInt("quantity"),
                        rs.getString("status"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("expires_at", OffsetDateTime.class),
                        rs.getObject("closed_at", OffsetDateTime.class)),
                args.toArray());
    }

    public record LocationAvailability(String locationCode, String locationName, int available) {
    }

    public record Availability(Long productId, int totalAvailable, List<LocationAvailability> byLocation) {
    }

    public record ReservationView(
            Long id,
            Long orderId,
            Long productId,
            String sku,
            String productName,
            String locationCode,
            int quantity,
            String status,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt,
            OffsetDateTime closedAt) {
    }
}
