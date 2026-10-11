package com.sgologic.integration.erp;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/integration/erp/customers/{id}/history")
public class ErpCustomerHistoryController {
    private final ErpCustomerHistoryService histories;
    private final com.sgologic.audit.AuditService audit;
    public ErpCustomerHistoryController(ErpCustomerHistoryService histories,com.sgologic.audit.AuditService audit){this.histories=histories;this.audit=audit;}
    @GetMapping public Map<String,Object> get(@PathVariable Long id){return histories.detail(id);}
    @PostMapping("/refresh") public Map<String,Object> refresh(@PathVariable Long id){
        if(!histories.refresh(id,true))throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"El ERP no está disponible; no se actualizó el historial");
        return histories.detail(id);
    }
    @PutMapping public Map<String,Object> importLegacy(@PathVariable Long id,@RequestBody ErpCustomerHistoryService.History history){
        var result=histories.importLegacy(id,history);
        audit.record(com.sgologic.audit.AuditService.currentActor(),"ERP_HISTORIAL_IMPORTADO","customer",id,null,null,Map.of("origen","ERP histórico"));
        return result;
    }
}
