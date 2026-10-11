package com.sgologic.payments;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.List;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/customers/{customerId}/credit")
public class CreditController {
    private final CreditService credit;
    public CreditController(CreditService credit) { this.credit=credit; }
    @GetMapping public Map<String,Object> account(@PathVariable Long customerId) { return credit.account(customerId); }
    @GetMapping("/charges") public List<Map<String,Object>> charges(@PathVariable Long customerId) { return credit.charges(customerId); }
    @GetMapping("/applications") public List<Map<String,Object>> applications(@PathVariable Long customerId){return credit.applications(customerId);}
    @PostMapping("/charges/{id}/retry") public Map<String,Object> retry(@PathVariable Long customerId,@PathVariable Long id) { return credit.retryRepayment(customerId,id); }
    @PostMapping("/charges/{id}/repay") public Map<String,Object> repay(@PathVariable Long customerId,@PathVariable Long id,@Valid @RequestBody Repay body) {
        if(CardDataGuard.looksLikeCardNumber(body.cardToken())) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"se requiere token de pago");
        return credit.repay(customerId,id,body.cardToken());
    }
    public record Repay(@NotBlank String cardToken) {}
}
