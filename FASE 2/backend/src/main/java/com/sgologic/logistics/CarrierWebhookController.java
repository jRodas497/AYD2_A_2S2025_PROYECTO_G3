package com.sgologic.logistics;

import com.sgologic.external.Provider;
import com.sgologic.external.ProviderHttp;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** The external carrier posts tracking updates through an authenticated integration boundary. */
@RestController
public class CarrierWebhookController {
    private final DispatchService dispatch;
    private final ProviderHttp providers;
    private final String key;
    public CarrierWebhookController(DispatchService dispatch, ProviderHttp providers,
                                   @Value("${CARRIER_WEBHOOK_KEY:sgologic-local-carrier-key}") String key) {
        this.dispatch=dispatch; this.providers=providers; this.key=key;
    }
    @PostMapping("/api/providers/logiexpress/tracking")
    public Map<String,Object> receive(@RequestHeader(value="X-Provider-Key",required=false) String provided,
                                      @RequestBody Tracking body) {
        if(provided==null || !java.security.MessageDigest.isEqual(key.getBytes(java.nio.charset.StandardCharsets.UTF_8),provided.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"clave del transportista inválida");
        ShipmentStatus state;
        try { state=ShipmentStatus.valueOf(body.status()); }
        catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"estado de entrega inválido"); }
        Shipment shipment=dispatch.applyTrackingUpdate(body.shipmentId(),state,body.detail());
        return Map.of("id",shipment.getId(),"status",shipment.getStatus().code());
    }
    @PostMapping("/api/shipments/{id}/simulate-tracking")
    public Map<?,?> simulate(@PathVariable Long id,@RequestBody TrackingRequest body) {
        return providers.request(Provider.LOGIEXPRESS,"/tracking","POST",null,
                Map.of("shipmentId",id,"status",body.status(),"detail",String.valueOf(body.detail())),7000,Map.class);
    }
    public record Tracking(Long shipmentId,String status,String detail) {}
    public record TrackingRequest(String status,String detail) {}
}
