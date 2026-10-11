package com.sgologic.auth;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Store employees/managers can mutate only their assigned location; central operations span the network. */
@Service
public class StoreAccess {
    private final JdbcTemplate jdbc;
    public StoreAccess(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    public Long assignedStore() {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth==null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"hace falta iniciar sesión");
        var roles=auth.getAuthorities().stream().map(a -> a.getAuthority()).toList();
        if(roles.contains("ROLE_ADMIN") || roles.contains("ROLE_LOGISTICS")) return null;
        if(!roles.contains("ROLE_STORE_EMPLOYEE") && !roles.contains("ROLE_STORE_MANAGER")) return null;
        var stores=jdbc.queryForList("select store_id from config.app_user where username=? and active",Long.class,auth.getName());
        if(stores.isEmpty() || stores.get(0)==null) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"el usuario requiere una tienda asignada");
        return stores.get(0);
    }
    public void requireLocation(String code) {
        Long store=assignedStore();
        if(store!=null && !Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from inventory.location where id=? and code=?)",Boolean.class,store,code)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"solo puedes operar tu tienda asignada");
    }
    public void requireShipment(Long id) {
        Long store=assignedStore();
        if(store!=null && !Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from logistics.shipment where id=? and origin_location_id=?)",Boolean.class,id,store)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"el envío pertenece a otra ubicación");
    }
    public void requireOrder(Long id) {
        Long store=assignedStore();
        if(store!=null && !Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from orders.purchase_order o where o.id=? and (o.pickup_location_id=? or exists(select 1 from inventory.reservation r where r.order_id=o.id and r.location_id=?)))",Boolean.class,id,store,store)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"la orden pertenece a otra ubicación");
    }
}
