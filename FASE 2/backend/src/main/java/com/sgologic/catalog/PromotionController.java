package com.sgologic.catalog;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@RestController
@RequestMapping("/api/promotions")
public class PromotionController {
    private final JdbcTemplate jdbc;
    public PromotionController(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @GetMapping public List<Map<String,Object>> list() {
        return jdbc.query("select p.id,p.name,p.description,p.discount_percent,c.code,p.ends_at from catalog.promotion p join catalog.product_category c on c.id=p.category_id where p.active and p.starts_at<=now() and p.ends_at>now() order by p.id",
                (rs, row) -> Map.<String,Object>of("id",rs.getLong("id"),"nombre",rs.getString("name"),
                        "descripcion",java.util.Objects.toString(rs.getString("description"),""),
                        "descuentoPorcentaje",rs.getBigDecimal("discount_percent"),
                        "categoriasAplicables",List.of(rs.getString("code")),"ends_at",rs.getTimestamp("ends_at").toInstant()));
    }
    @PostMapping public Map<String,Object> create(@Valid @RequestBody Create body) {
        if(!body.endsAt().isAfter(OffsetDateTime.now())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"la promoción debe terminar en el futuro");
        Long id=jdbc.queryForObject("insert into catalog.promotion(name,description,discount_percent,category_id,ends_at) values(?,?,?,?,?) returning id",Long.class,body.name(),body.description(),body.discountPercent(),body.category().id(),body.endsAt());
        return Map.of("id",id);
    }
    @PutMapping("/{id}/active") public Map<String,Object> active(@PathVariable Long id,@RequestBody Active body) {
        if(jdbc.update("update catalog.promotion set active=? where id=?",body.active(),id)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"promoción no encontrada");
        return Map.of("id",id,"active",body.active());
    }
    public record Create(@NotBlank String name,String description,@DecimalMin("0.01") @DecimalMax("99.99") @NotNull BigDecimal discountPercent,@NotNull ProductCategory category,@NotNull OffsetDateTime endsAt) {}
    public record Active(boolean active) {}
}
