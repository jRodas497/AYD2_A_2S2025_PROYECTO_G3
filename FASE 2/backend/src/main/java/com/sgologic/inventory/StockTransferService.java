package com.sgologic.inventory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgologic.audit.AuditService;
import com.sgologic.auth.StoreAccess;
import com.sgologic.external.Provider;
import com.sgologic.external.ProviderHttp;
import com.sgologic.integration.OutboxService;
import com.sgologic.integration.pos.PosEventService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

/** Transfers own their merchandise until receipt; goods in transit are never sellable stock. */
@Service
public class StockTransferService {
    private final JdbcTemplate jdbc;
    private final OutboxService outbox;
    private final AuditService audit;
    private final PosEventService pos;
    private final ProviderHttp providers;
    private final TransactionTemplate tx;
    private final ObjectMapper json;
    private final StoreAccess stores;
    public StockTransferService(JdbcTemplate jdbc,OutboxService outbox,AuditService audit,PosEventService pos,ProviderHttp providers,TransactionTemplate tx,ObjectMapper json,StoreAccess stores){
        this.jdbc=jdbc;this.outbox=outbox;this.audit=audit;this.pos=pos;this.providers=providers;this.tx=tx;this.json=json;this.stores=stores;
    }
    public record Item(@NotNull Long productId,@Min(1) @Max(1000000) int quantity){}
    public record Input(@NotBlank @Pattern(regexp="[a-fA-F0-9-]{36}") String requestKey,@NotNull Long sourceId,@NotNull Long destinationId,@NotBlank @Size(max=300) String reason,@NotEmpty @Size(max=50) List<@Valid Item> items){}
    public record Transport(@NotBlank @Size(max=120) String carrierName,@NotBlank @Size(max=100) String reference,@NotBlank @Size(max=120) String driverName,@NotBlank @Size(max=30) String vehiclePlate){}

    @Transactional public Map<String,Object> create(Input body) {
        jdbc.queryForObject("select pg_advisory_xact_lock(hashtext(?))",Object.class,body.requestKey());
        String hash;
        try{hash=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(body)));}
        catch(Exception e){throw new IllegalStateException(e);}
        var existing=jdbc.queryForList("select id,payload_hash,actor from inventory.stock_transfer where request_key=?",body.requestKey());
        if(!existing.isEmpty()){
            var old=existing.get(0);
            if(!old.get("actor").equals(AuditService.currentActor()))throw error(HttpStatus.FORBIDDEN,"la solicitud pertenece a otro operador");
            if(!old.get("payload_hash").equals(hash))throw error(HttpStatus.CONFLICT,"la misma solicitud ya se usó con otros datos");
            return detail(number(old,"id"));
        }
        locations(body.sourceId(),body.destinationId());
        var items=body.items().stream().sorted(Comparator.comparing(Item::productId)).toList();
        if(items.stream().map(Item::productId).distinct().count()!=items.size())throw error(HttpStatus.BAD_REQUEST,"cada producto debe aparecer una sola vez");
        Long id=jdbc.queryForObject("insert into inventory.stock_transfer(request_key,payload_hash,source_id,destination_id,reason,actor) values(?,?,?,?,?,?) returning id",Long.class,body.requestKey(),hash,body.sourceId(),body.destinationId(),body.reason().trim(),AuditService.currentActor());
        for(var item:items){
            if(!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from catalog.product where id=? and active)",Boolean.class,item.productId())))throw error(HttpStatus.NOT_FOUND,"producto no disponible");
            int reserved=jdbc.update("update inventory.stock set reserved=reserved+?,updated_at=now() where location_id=? and product_id=? and on_hand-reserved>=?",item.quantity(),body.sourceId(),item.productId(),item.quantity());
            if(reserved!=1)throw new InsufficientStockException(item.productId(),item.quantity());
            jdbc.update("insert into inventory.stock_transfer_item(transfer_id,product_id,quantity) values(?,?,?)",id,item.productId(),item.quantity());
        }
        event(id,"PENDING","Mercancía reservada para traslado");
        record(id,null,"TRASLADO_CREADO",Map.of("origen",body.sourceId(),"destino",body.destinationId()));return detail(id);
    }
    public List<Map<String,Object>> list(String status) {
        Long store=stores.assignedStore();
        String sql=columns()+" where 1=1";List<Object> args=new ArrayList<>();
        if(status!=null&&!status.isBlank()){sql+=" and t.status=?";args.add(status);}
        if(store!=null){sql+=" and (t.source_id=? or t.destination_id=?)";args.add(store);args.add(store);}
        return jdbc.queryForList(sql+" order by t.id desc limit 100",args.toArray());
    }
    public List<Map<String,Object>> ofOrder(Long order){return jdbc.queryForList(columns()+" where t.order_id=? order by t.id",order);}
    public Map<String,Object> detail(Long id){
        var rows=jdbc.queryForList(columns()+" where t.id=?",id);if(rows.isEmpty())throw error(HttpStatus.NOT_FOUND,"traslado no encontrado");
        var result=rows.get(0);result.put("items",items(id));result.put("events",jdbc.queryForList("select status,detail,actor,created_at from inventory.stock_transfer_event where transfer_id=? order by id",id));return result;
    }
    public void requireAccess(Long id){var t=detail(id);Long store=stores.assignedStore();if(store!=null&&!store.equals(number(t,"source_id"))&&!store.equals(number(t,"destination_id")))throw error(HttpStatus.FORBIDDEN,"el traslado pertenece a otra ubicación");}
    private String columns(){return "select t.*,s.code as source_code,s.name as source_name,d.code as destination_code,d.name as destination_name from inventory.stock_transfer t join inventory.location s on s.id=t.source_id join inventory.location d on d.id=t.destination_id";}

    /** Called with the order locked. A new invoice event resumes dispatch after all receipts. */
    public boolean consolidate(Long order,Long destination,List<ReservationLifecycleService.ReservedLine> lines) {
        var pending=jdbc.queryForList("select id from inventory.stock_transfer where order_id=? and status in ('PENDING','IN_TRANSIT')",Long.class,order);
        if(!pending.isEmpty())return true;
        var grouped=new TreeMap<Long,List<ReservationLifecycleService.ReservedLine>>();
        for(var line:lines)if(!line.locationId().equals(destination))grouped.computeIfAbsent(line.locationId(),key->new ArrayList<>()).add(line);
        for(var entry:grouped.entrySet()){
            locations(entry.getKey(),destination);
            Long id=jdbc.queryForObject("insert into inventory.stock_transfer(source_id,destination_id,order_id,reason,actor) values(?,?,?,'Consolidación de mercancía para despacho','system') returning id",Long.class,entry.getKey(),destination,order);
            for(var line:entry.getValue()){
                jdbc.update("insert into inventory.stock_transfer_item(transfer_id,product_id,quantity,reservation_id) values(?,?,?,?)",id,line.productId(),line.quantity(),line.reservationId());
                jdbc.update("update inventory.reservation set transfer_id=? where id=?",id,line.reservationId());
            }
            event(id,"PENDING","Consolidación de la orden "+order);queue(id);record(id,order,"TRASLADO_CREADO",Map.of("origen",entry.getKey(),"destino",destination));
        }
        return !grouped.isEmpty();
    }
    @Transactional public Map<String,Object> requestTransport(Long id){
        var t=lock(id);if(!"PENDING".equals(t.get("status")))return detail(id);
        jdbc.update("update inventory.stock_transfer set last_error=null where id=?",id);queue(id);return detail(id);
    }
    private void queue(Long id){outbox.publish("stock_transfer",id,"TransferDispatchRequested",Map.of("transferId",id));}
    public void dispatch(Long id) {
        var transfer=tx.execute(status->{var t=lock(id);return "PENDING".equals(t.get("status"))?t:null;});if(transfer==null)return;
        var guide=providers.execute(Provider.LOGIEXPRESS,"transfer-"+id,Map.of("operation","TRANSFER","transferId",id,"origin",transfer.get("source_id"),"destination",transfer.get("destination_id"),"autoDeliver",transfer.get("order_id")!=null),5000,Map.class);
        Object reference=guide.get("trackingNumber");if(reference==null)throw new IllegalStateException("el transportista no emitió referencia del traslado");
        tx.executeWithoutResult(status->depart(id,"LogiExpress",String.valueOf(reference)));
    }
    @Transactional public Map<String,Object> departManual(Long id,Transport body){
        var t=lock(id);
        if(!"PENDING".equals(t.get("status"))){
            if(("IN_TRANSIT".equals(t.get("status"))||"RECEIVED".equals(t.get("status"))) && Objects.equals(body.carrierName().trim(),t.get("carrier_name")) && Objects.equals(body.reference().trim(),t.get("transport_reference")) && Objects.equals(body.driverName().trim(),t.get("driver_name")) && Objects.equals(body.vehiclePlate().trim(),t.get("vehicle_plate")))return detail(id);
            throw error(HttpStatus.CONFLICT,"el traslado ya salió o fue cancelado; no se puede asignar otra salida");
        }
        depart(id,body.carrierName().trim(),body.reference().trim());
        jdbc.update("update inventory.stock_transfer set driver_name=?,vehicle_plate=? where id=?",body.driverName().trim(),body.vehiclePlate().trim(),id);
        record(id,nullableNumber(t,"order_id"),"TRASLADO_TRANSPORTE_MANUAL",Map.of("conductor",body.driverName(),"placa",body.vehiclePlate()));return detail(id);
    }
    private void depart(Long id,String carrier,String reference) {
        var t=lock(id);if(!"PENDING".equals(t.get("status")))return;
        Long order=nullableNumber(t,"order_id");
        if(order!=null&&closed(order)){cancelPendingOrder(order);return;}
        for(var item:items(id)){
            int quantity=((Number)item.get("quantity")).intValue();Long source=number(t,"source_id"),product=number(item,"product_id");
            int changed=jdbc.update("update inventory.stock set on_hand=on_hand-?,reserved=reserved-?,updated_at=now() where location_id=? and product_id=? and on_hand>=? and reserved>=?",quantity,quantity,source,product,quantity,quantity);
            if(changed!=1)throw new IllegalStateException("la mercancía del traslado ya no está reservada");
            movement(source,product,quantity,"OUT",(order==null?"Salida de traslado ":"Traslado al origen de despacho ")+id,order);notifyPos(source,product,quantity,id);
        }
        jdbc.update("update inventory.stock_transfer set status='IN_TRANSIT',carrier_name=?,transport_reference=?,dispatched_at=now(),last_error=null where id=?",carrier,reference,id);
        event(id,"IN_TRANSIT","Salida con "+carrier+" · "+reference);record(id,order,"TRASLADO_SALIDA",Map.of("transportista",carrier,"referencia",reference));
    }
    @Transactional public Map<String,Object> receive(Long id,String reference,boolean provider) {
        var t=lock(id);
        if(provider&&"CANCELLED".equals(t.get("status")))return detail(id);
        if(provider&&"PENDING".equals(t.get("status")))throw error(HttpStatus.CONFLICT,"el traslado todavía no salió; vuelve a confirmar la recepción después de la salida");
        if(provider&&(!"LogiExpress".equals(t.get("carrier_name"))||!Objects.equals(reference,t.get("transport_reference"))))throw error(HttpStatus.CONFLICT,"la actualización no corresponde al transporte vigente");
        if(!provider)stores.requireLocation(locationCode(number(t,"destination_id")));
        if("RECEIVED".equals(t.get("status")))return detail(id);
        if(!"IN_TRANSIT".equals(t.get("status")))throw error(HttpStatus.CONFLICT,"solo se recibe mercancía que ya salió");
        if(!provider)stores.requireLocation(locationCode(number(t,"destination_id")));
        Long order=nullableNumber(t,"order_id");boolean returned=order!=null&&closed(order);
        for(var item:items(id)){
            int quantity=((Number)item.get("quantity")).intValue();Long destination=number(t,"destination_id"),product=number(item,"product_id");
            int reserve=order!=null&&!returned?quantity:0;
            jdbc.update("insert into inventory.stock(location_id,product_id,on_hand,reserved) values(?,?,?,?) on conflict(location_id,product_id) do update set on_hand=stock.on_hand+excluded.on_hand,reserved=stock.reserved+excluded.reserved,updated_at=now()",destination,product,quantity,reserve);
            if(item.get("reservation_id")!=null)jdbc.update("update inventory.reservation set location_id=?,transfer_id=null,status_id=?,closed_at=now() where id=?",destination,returned?3:2,item.get("reservation_id"));
            movement(destination,product,quantity,"IN","Recepción de traslado "+id,order);notifyPos(destination,product,quantity,id);
        }
        jdbc.update("update inventory.stock_transfer set status='RECEIVED',received_at=now(),last_error=null where id=?",id);
        event(id,"RECEIVED","Recepción confirmada en "+locationCode(number(t,"destination_id")));record(id,order,"TRASLADO_RECIBIDO",Map.of("destino",number(t,"destination_id")));
        if(order!=null&&!returned&&!Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from inventory.stock_transfer where order_id=? and status in ('PENDING','IN_TRANSIT'))",Boolean.class,order))) {
            outbox.publishForOrder(order,"OrderInvoiced",Map.of("orderId",order));
            audit.recordSystem("DESPACHO_CONSOLIDADO","order",order,order,null,Map.of("origen",locationCode(number(t,"destination_id"))));
        }
        return detail(id);
    }
    @Transactional public Map<String,Object> cancel(Long id) {
        var t=lock(id);if("CANCELLED".equals(t.get("status")))return detail(id);
        if(t.get("order_id")!=null)throw error(HttpStatus.CONFLICT,"el traslado está ligado a una compra; gestiona su devolución");
        if(!"PENDING".equals(t.get("status")))throw error(HttpStatus.CONFLICT,"el traslado ya salió; confirma su recepción y registra otro traslado para devolverlo");
        for(var item:items(id))jdbc.update("update inventory.stock set reserved=reserved-?,updated_at=now() where location_id=? and product_id=?",item.get("quantity"),t.get("source_id"),item.get("product_id"));
        jdbc.update("update inventory.stock_transfer set status='CANCELLED',last_error=null where id=?",id);event(id,"CANCELLED","Traslado cancelado antes de salir");record(id,null,"TRASLADO_CANCELADO",Map.of());return detail(id);
    }
    /** Refund owns the order lock and releases its reservations after cancelling unsent transfers. */
    public void cancelPendingOrder(Long order) {
        var ids=jdbc.queryForList("update inventory.stock_transfer set status='CANCELLED',last_error=null where order_id=? and status='PENDING' returning id",Long.class,order);
        for(Long id:ids){jdbc.update("update inventory.reservation set transfer_id=null where transfer_id=?",id);event(id,"CANCELLED","Compra devuelta antes de la salida del traslado");}
    }
    public void exhausted(Long id,String error){jdbc.update("update inventory.stock_transfer set last_error=? where id=? and status='PENDING'",error,id);}
    private Map<String,Object> lock(Long id) {
        var rows=jdbc.queryForList("select * from inventory.stock_transfer where id=?",id);if(rows.isEmpty())throw error(HttpStatus.NOT_FOUND,"traslado no encontrado");var t=rows.get(0);
        if("CANCELLED".equals(t.get("status")) || "RECEIVED".equals(t.get("status")))return jdbc.queryForMap("select * from inventory.stock_transfer where id=? for update",id);
        if(t.get("order_id")!=null)jdbc.queryForObject("select id from orders.purchase_order where id=? for update",Long.class,t.get("order_id"));
        locations(number(t,"source_id"),number(t,"destination_id"));return jdbc.queryForMap("select * from inventory.stock_transfer where id=? for update",id);
    }
    private void locations(Long source,Long destination){
        if(source.equals(destination))throw error(HttpStatus.BAD_REQUEST,"origen y destino deben ser diferentes");
        var locations=jdbc.queryForList("select id from inventory.location where id in (?,?) and active order by id for share",Long.class,source,destination);
        if(locations.size()!=2)throw error(HttpStatus.CONFLICT,"el origen y el destino deben ser ubicaciones activas");
    }
    private List<Map<String,Object>> items(Long id){return jdbc.queryForList("select i.*,p.sku,p.name as product_name from inventory.stock_transfer_item i join catalog.product p on p.id=i.product_id where i.transfer_id=? order by i.product_id,i.id",id);}
    private boolean closed(Long order){return Boolean.TRUE.equals(jdbc.queryForObject("select status_id in (8,9) from orders.purchase_order where id=?",Boolean.class,order));}
    private String locationCode(Long id){return jdbc.queryForObject("select code from inventory.location where id=?",String.class,id);}
    private void movement(Long location,Long product,int qty,String type,String reason,Long order){jdbc.update("insert into inventory.stock_movement(location_id,product_id,type_id,quantity,reason,order_id) values(?,?,?, ?,?,?)",location,product,type.equals("IN")?1:2,qty,reason,order);}
    private void notifyPos(Long location,Long product,int qty,Long transfer){if(jdbc.queryForObject("select type_id from inventory.location where id=?",Integer.class,location)==2)pos.publish(location,PosEventService.STOCK_ADJUSTED,Map.of("productId",product,"quantity",qty,"transferId",transfer));}
    private void event(Long id,String status,String detail){jdbc.update("insert into inventory.stock_transfer_event(transfer_id,status,detail,actor) values(?,?,?,?)",id,status,detail,AuditService.currentActor());}
    private void record(Long id,Long order,String action,Map<String,Object> details){audit.record(AuditService.currentActor(),action,"stock_transfer",id,order,null,details);}
    private Long number(Map<String,Object> map,String key){return ((Number)map.get(key)).longValue();}
    private Long nullableNumber(Map<String,Object> map,String key){return map.get(key)==null?null:number(map,key);}
    private ResponseStatusException error(HttpStatus status,String message){return new ResponseStatusException(status,message);}
}
