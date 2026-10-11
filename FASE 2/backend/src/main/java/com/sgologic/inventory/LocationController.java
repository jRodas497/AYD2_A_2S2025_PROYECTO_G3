package com.sgologic.inventory;

import com.sgologic.audit.AuditService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/inventory/locations")
public class LocationController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    public LocationController(JdbcTemplate jdbc,AuditService audit){this.jdbc=jdbc;this.audit=audit;}
    @GetMapping("/manage") public List<Map<String,Object>> list(){return jdbc.queryForList("select l.*,t.code as type from inventory.location l join inventory.location_type t on t.id=l.type_id order by l.id");}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> create(@Valid @RequestBody Input body){
        Long id=jdbc.queryForObject("insert into inventory.location(code,name,type_id,address) values(?,?,?,?) returning id",Long.class,body.code(),body.name().trim(),body.type().id(),body.address().trim());
        jdbc.update("insert into inventory.stock(location_id,product_id) select ?,id from catalog.product",id);
        audit.record(AuditService.currentActor(),"UBICACION_CREADA","location",id,null,null,Map.of("codigo",body.code(),"tipo",body.type().code()));
        return detail(id);
    }
    @PutMapping("/{id}") @Transactional public Map<String,Object> update(@PathVariable Long id,@Valid @RequestBody Input body){
        var current=lock(id);
        if(!current.get("code").equals(body.code())||((Number)current.get("type_id")).shortValue()!=body.type().id())throw conflict("el código y el tipo son permanentes para conservar la trazabilidad");
        jdbc.update("update inventory.location set name=?,address=? where id=?",body.name().trim(),body.address().trim(),id);
        audit.record(AuditService.currentActor(),"UBICACION_ACTUALIZADA","location",id,null,null,Map.of("nombre",body.name(),"direccion",body.address()));return detail(id);
    }
    @PutMapping("/{id}/active") @Transactional public Map<String,Object> active(@PathVariable Long id,@Valid @RequestBody Active body){
        lock(id);
        if(!body.active()) {
            boolean blocked=Boolean.TRUE.equals(jdbc.queryForObject("""
              select exists(select 1 from inventory.stock where location_id=? and (on_hand>0 or reserved>0))
              or exists(select 1 from inventory.reservation r join orders.purchase_order o on o.id=r.order_id where r.location_id=? and r.status_id in (1,2) and o.status_id not in (7,8,9) and not exists(select 1 from logistics.shipment s where s.order_id=o.id))
              or exists(select 1 from inventory.stock_transfer where (source_id=? or destination_id=?) and status in ('PENDING','IN_TRANSIT'))
              or exists(select 1 from logistics.shipment s join orders.purchase_order o on o.id=s.order_id where s.origin_location_id=? and s.status_id<>5 and o.status_id not in (8,9))
              or exists(select 1 from orders.purchase_order where pickup_location_id=? and status_id not in (7,8,9))
              or exists(select 1 from config.app_user where store_id=? and active)
              """,Boolean.class,id,id,id,id,id,id,id));
            if(blocked)throw conflict("la ubicación tiene existencias, reservas, traslados, entregas o personal activo; resuélvelos antes de desactivarla");
        }
        jdbc.update("update inventory.location set active=? where id=?",body.active(),id);
        audit.record(AuditService.currentActor(),"UBICACION_ESTADO","location",id,null,null,Map.of("activa",body.active()));return detail(id);
    }
    private Map<String,Object> lock(Long id){var rows=jdbc.queryForList("select * from inventory.location where id=? for update",id);if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"ubicación no encontrada");return rows.get(0);}
    private Map<String,Object> detail(Long id){return jdbc.queryForMap("select l.*,t.code as type from inventory.location l join inventory.location_type t on t.id=l.type_id where l.id=?",id);}
    private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
    public record Input(@NotBlank @Pattern(regexp="[A-Z0-9][A-Z0-9-]{1,29}") String code,@NotBlank @Size(max=120) String name,@NotNull LocationType type,@NotBlank @Size(max=300) String address){}
    public record Active(@NotNull Boolean active){}
}
