package com.sgologic.customers;

import com.sgologic.audit.AuditService;
import com.sgologic.external.MessagingClient;
import com.sgologic.integration.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Single-use recovery links delivered through the durable messaging integration. */
@Service
public class CustomerAccountService implements OutboxHandler {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final OutboxService outbox;
    private final AuditService audit;
    private final MessagingClient messaging;
    private final SecretKeySpec key;
    private final String frontendUrl;
    public CustomerAccountService(JdbcTemplate jdbc,PasswordEncoder encoder,OutboxService outbox,AuditService audit,
            MessagingClient messaging,@Value("${sgologic.auth.jwt-secret}") String secret,
            @Value("${sgologic.auth.frontend-url:http://localhost:8081}") String frontendUrl) {
        this.jdbc=jdbc;this.encoder=encoder;this.outbox=outbox;this.audit=audit;this.messaging=messaging;
        this.key=new SecretKeySpec(digest(secret),"AES");this.frontendUrl=frontendUrl.replaceAll("/$","");
    }
    @Transactional
    public void forgot(String email) {
        var ids=jdbc.queryForList("select id from customers.customer where lower(email)=lower(?) and active and password_hash is not null for update",Long.class,email.trim());
        if(ids.isEmpty()) return;
        Long id=ids.get(0);
        if(Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from customers.password_reset where customer_id=? and created_at>now()-interval '1 minute')",Boolean.class,id))) return;
        String token=UUID.randomUUID()+"-"+UUID.randomUUID();
        jdbc.update("update customers.password_reset set used_at=now() where customer_id=? and used_at is null",id);
        Long reset=jdbc.queryForObject("insert into customers.password_reset(customer_id,token_hash,token_encrypted,expires_at) values(?,?,?,now()+interval '30 minutes') returning id",Long.class,id,hash(token),encrypt(token));
        outbox.publish("customer_password_reset",reset,eventType(),Map.of("resetId",reset));
        audit.recordSystem("CLIENTE_RECUPERACION_SOLICITADA","customer",id,null,null,Map.of());
    }
    @Transactional
    public void reset(String token,String password) {
        var rows=jdbc.queryForList("select customer_id,id from customers.password_reset where token_hash=?",hash(token));
        if(rows.isEmpty()) throw invalidToken();
        Long customer=((Number)rows.get(0).get("customer_id")).longValue();
        lock(customer);
        int consumed=jdbc.update("update customers.password_reset set used_at=now() where id=? and used_at is null and expires_at>now()",rows.get(0).get("id"));
        if(consumed!=1) throw invalidToken();
        jdbc.update("update customers.customer set password_hash=?,auth_version=auth_version+1 where id=?",encoder.encode(password),customer);
        jdbc.update("update customers.password_reset set used_at=now() where customer_id=? and used_at is null",customer);
        audit.recordSystem("CLIENTE_CONTRASENA_RECUPERADA","customer",customer,null,null,Map.of());
    }
    @Transactional
    public void changePassword(Long id,String current,String password) {
        var row=lock(id);
        if(row.get("password_hash")==null || !encoder.matches(current,String.valueOf(row.get("password_hash"))))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"contraseña actual incorrecta");
        jdbc.update("update customers.customer set password_hash=?,auth_version=auth_version+1 where id=?",encoder.encode(password),id);
        jdbc.update("update customers.password_reset set used_at=now() where customer_id=? and used_at is null",id);
        audit.record(AuditService.currentActor(),"CLIENTE_CONTRASENA_CAMBIADA","customer",id,null,null,Map.of());
    }
    @Transactional
    public void active(Long id,boolean active) {
        if(jdbc.queryForList("select id from customers.customer where id=? for update",Long.class,id).isEmpty())
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"cliente no encontrado");
        jdbc.update("update customers.customer set active=?,auth_version=auth_version+case when active<>? then 1 else 0 end where id=?",active,active,id);
        if(!active) jdbc.update("update customers.password_reset set used_at=now() where customer_id=? and used_at is null",id);
        audit.record(AuditService.currentActor(),active?"CLIENTE_ACTIVADO":"CLIENTE_DESACTIVADO","customer",id,null,null,Map.of());
    }
    private Map<String,Object> lock(Long id) {
        var rows=jdbc.queryForList("select password_hash from customers.customer where id=? and active for update",id);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"cliente inactivo o inexistente");
        return rows.get(0);
    }
    @Override public String eventType() { return "CustomerPasswordRecoveryRequested"; }
    @Override public void handle(OutboxEvent event) {
        var rows=jdbc.queryForList("select r.token_encrypted,c.email from customers.password_reset r join customers.customer c on c.id=r.customer_id where r.id=? and r.used_at is null and r.expires_at>now() and c.active",event.longValue("resetId"));
        if(rows.isEmpty()) return;
        String rejection=messaging.send("EMAIL",String.valueOf(rows.get(0).get("email")),"Recupera tu cuenta: "+frontendUrl+"/recuperar?token="+decrypt(String.valueOf(rows.get(0).get("token_encrypted")))+" . El enlace vence en 30 minutos y se usa una sola vez.");
        if(rejection!=null) throw new IllegalStateException(rejection);
    }
    private static ResponseStatusException invalidToken() { return new ResponseStatusException(HttpStatus.BAD_REQUEST,"enlace inválido, utilizado o vencido"); }
    private static byte[] digest(String text) {
        try { return MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    private static String hash(String text) { return HexFormat.of().formatHex(digest(text)); }
    private String encrypt(String text) {
        try {
            byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key,new GCMParameterSpec(128,iv));
            byte[] encrypted=cipher.doFinal(text.getBytes(StandardCharsets.UTF_8));
            byte[] result=new byte[iv.length+encrypted.length];System.arraycopy(iv,0,result,0,iv.length);System.arraycopy(encrypted,0,result,iv.length,encrypted.length);
            return Base64.getEncoder().encodeToString(result);
        } catch(Exception e) { throw new IllegalStateException("no se pudo proteger el enlace de recuperación",e); }
    }
    private String decrypt(String text) {
        try {
            byte[] bytes=Base64.getDecoder().decode(text);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,key,new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));
            return new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8);
        } catch(Exception e) { throw new IllegalStateException("no se pudo recuperar el enlace",e); }
    }
}
