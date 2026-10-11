package com.sgologic.customers;

import com.sgologic.orders.Incident;
import com.sgologic.orders.IncidentService;
import com.sgologic.orders.dto.OrderOverview;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Consultar historial (CDU expandido Atención al Cliente): las órdenes del cliente, más recientes
 * primero, con el mismo detalle que la consulta de una orden, y las incidencias que ha tenido.
 *
 * <p>La consulta va por el índice {@code purchase_order (customer_id, created_at desc)} que ya
 * trae la base, y lee de la vista {@code orders.order_overview}: no arma el estado de cada orden
 * con consultas adicionales.
 */
@RestController
@RequestMapping("/api/customers/{customerId}")
public class CustomerHistoryController {

    @org.springframework.beans.factory.annotation.Autowired
    private com.sgologic.orders.OrderQueryService orderQueries;
    private final CustomerRepository customers;
    private final IncidentService incidents;
    private final JdbcTemplate jdbc;

    public CustomerHistoryController(CustomerRepository customers, IncidentService incidents, JdbcTemplate jdbc) {
        this.customers = customers;
        this.incidents = incidents;
        this.jdbc = jdbc;
    }

    @GetMapping("/orders")
    public List<OrderOverview> orders(@PathVariable Long customerId, @RequestParam(defaultValue = "50") int limit) {
        requireCustomer(customerId);
        return orderQueries.search(null,customerId,null,null,Math.max(1,Math.min(500,limit)));
    }

    /** Órdenes e incidencias en una sola respuesta: lo que ve el agente al abrir la ficha del cliente. */
    @GetMapping("/history")
    public History history(@PathVariable Long customerId, @RequestParam(defaultValue = "50") int limit) {
        Customer customer = requireCustomer(customerId);
        return new History(customer, orders(customerId, limit), incidents.findByCustomer(customerId, limit));
    }

    private Customer requireCustomer(Long customerId) {
        return customers.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "cliente no encontrado"));
    }

    public record History(Customer customer, List<OrderOverview> orders, List<Incident> incidents) {
    }
}
