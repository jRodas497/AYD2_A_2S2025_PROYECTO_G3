package com.sgologic.inventory;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
public class StockTransferController {
    private final StockTransferService transfers;
    public StockTransferController(StockTransferService transfers){this.transfers=transfers;}
    @GetMapping("/api/inventory/transfers") public List<Map<String,Object>> list(@RequestParam(required=false) String status){return transfers.list(status);}
    @GetMapping("/api/inventory/transfers/{id}") public Map<String,Object> detail(@PathVariable Long id){transfers.requireAccess(id);return transfers.detail(id);}
    @GetMapping("/api/orders/{order}/transfers") public List<Map<String,Object>> order(@PathVariable Long order){return transfers.ofOrder(order);}
    @PostMapping("/api/inventory/transfers") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> create(@Valid @RequestBody StockTransferService.Input body){return transfers.create(body);}
    @PostMapping("/api/inventory/transfers/{id}/transport") public Map<String,Object> transport(@PathVariable Long id){return transfers.requestTransport(id);}
    @PostMapping("/api/inventory/transfers/{id}/depart") public Map<String,Object> depart(@PathVariable Long id,@Valid @RequestBody StockTransferService.Transport body){return transfers.departManual(id,body);}
    @PostMapping("/api/inventory/transfers/{id}/receive") public Map<String,Object> receive(@PathVariable Long id){return transfers.receive(id,null,false);}
    @PostMapping("/api/inventory/transfers/{id}/cancel") public Map<String,Object> cancel(@PathVariable Long id){return transfers.cancel(id);}
}
