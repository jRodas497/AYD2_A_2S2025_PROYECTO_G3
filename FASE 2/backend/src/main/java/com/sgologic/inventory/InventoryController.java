package com.sgologic.inventory;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
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

    public record LocationAvailability(String locationCode, String locationName, int available) {
    }

    public record Availability(Long productId, int totalAvailable, List<LocationAvailability> byLocation) {
    }
}
