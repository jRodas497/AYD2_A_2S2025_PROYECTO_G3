package com.sgologic.integration.erp;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sgologic.external.Provider;
import com.sgologic.external.ProviderHttp;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** A bounded ERP read builds a local projection; payment transactions never wait on the ERP. */
@Service
public class ErpCustomerHistoryService {
    private final JdbcTemplate jdbc;
    private final ProviderHttp providers;
    private final ObjectMapper json;
    public ErpCustomerHistoryService(JdbcTemplate jdbc,ProviderHttp providers,ObjectMapper json) {
        this.jdbc=jdbc;this.providers=providers;this.json=json;
    }
    public String customerKey(Long id) {
        var rows=jdbc.queryForList("select coalesce(nullif(lower(email),''),'customer-'||id::text) as identity from customers.customer where id=? and active",String.class,id);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"cliente activo no encontrado");
        return rows.get(0);
    }
    public boolean refresh(Long id,boolean force) {
        String key=customerKey(id);
        if(!force&&current(id))return true;
        try {
            History history=providers.request(Provider.ERP,"/history?customer="+URLEncoder.encode(key,StandardCharsets.UTF_8),"GET",null,null,800,History.class);
            history.validate();
            jdbc.update("insert into integration.erp_customer_history(customer_id,customer_key,snapshot,fetched_at) values(?,?,?::jsonb,now()) on conflict(customer_id) do update set customer_key=excluded.customer_key,snapshot=excluded.snapshot,fetched_at=excluded.fetched_at",id,key,json.writeValueAsString(history));
            return true;
        } catch(Exception e) { return !force&&current(id); }
    }
    public boolean current(Long id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from integration.erp_customer_history h join customers.customer c on c.id=h.customer_id where h.customer_id=? and h.customer_key=coalesce(nullif(lower(c.email),''),'customer-'||c.id::text) and h.fetched_at>now()-interval '5 minutes')",Boolean.class,id));
    }
    public History history(Long id) {
        var rows=jdbc.queryForList("select snapshot::text from integration.erp_customer_history where customer_id=?",String.class,id);
        if(rows.isEmpty())return History.empty();
        try{return json.readValue(rows.get(0),History.class);}catch(Exception e){throw new IllegalStateException("historial ERP inválido",e);}
    }
    public Map<String,Object> detail(Long id) {
        boolean available=refresh(id,false);
        var rows=jdbc.queryForList("select fetched_at from integration.erp_customer_history where customer_id=?",OffsetDateTime.class,id);
        var result=new java.util.LinkedHashMap<String,Object>();
        result.put("available",available);result.put("history",history(id));result.put("fetchedAt",rows.isEmpty()?null:rows.get(0));
        return result;
    }
    public Map<String,Object> importLegacy(Long id,History history) {
        history.validate();
        providers.request(Provider.ERP,"/history","PUT",null,Map.of("customer",customerKey(id),"history",history),800,Map.class);
        if(!refresh(id,true))throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"no se pudo sincronizar el historial ERP");
        return detail(id);
    }
    public record History(int deliveredOrders,BigDecimal purchasedAmount,int latePayments,int overduePayments,int returns,int confirmedIncidents,int declinedPayments) {
        public static History empty(){return new History(0,BigDecimal.ZERO,0,0,0,0,0);}
        public void validate(){
            if(deliveredOrders<0||purchasedAmount==null||purchasedAmount.signum()<0||purchasedAmount.scale()>2||latePayments<0||overduePayments<0||returns<0||confirmedIncidents<0||declinedPayments<0)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"el historial requiere importes y contadores no negativos; el importe admite dos decimales");
        }
    }
}
