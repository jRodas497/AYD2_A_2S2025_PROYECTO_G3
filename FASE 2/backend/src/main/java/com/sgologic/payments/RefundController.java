package com.sgologic.payments;

import java.util.Map;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

/** Ownership is enforced by CustomerAccessFilter for the parent order. */
@RestController
public class RefundController {
    private final JdbcTemplate jdbc;
    public RefundController(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    @GetMapping("/api/orders/{id}/refunds")
    public List<Map<String,Object>> list(@PathVariable Long id) {
        return jdbc.queryForList("select id,amount,case status_id when 1 then 'PENDING' when 2 then 'REFUNDED' else 'FAILED' end as status,provider_reference,refunded_at,waiting_for_repayment from payments.refund where order_id=? order by id desc",id);
    }
}
