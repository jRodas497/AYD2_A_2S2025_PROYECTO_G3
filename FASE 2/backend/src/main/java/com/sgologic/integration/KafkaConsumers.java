package com.sgologic.integration;

import com.sgologic.notifications.NotificationService;
import com.sgologic.integration.pos.PosEventService;
import com.sgologic.integration.erp.ErpBatchService;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.EnableKafkaRetryTopic;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Component;

@Component
@EnableKafkaRetryTopic
public class KafkaConsumers {
    private final JdbcTemplate jdbc;
    private final OutboxRepository outbox;
    private final Map<String, OutboxHandler> handlers;
    private final NotificationService notifications;
    private final PosEventService pos;
    private final ErpBatchService erp;
    public KafkaConsumers(JdbcTemplate jdbc, OutboxRepository outbox, List<OutboxHandler> handlers,
                          NotificationService notifications, PosEventService pos, ErpBatchService erp) {
        this.jdbc=jdbc; this.outbox=outbox; this.notifications=notifications; this.pos=pos; this.erp=erp;
        this.handlers=handlers.stream().collect(java.util.stream.Collectors.toMap(OutboxHandler::eventType, h -> h));
    }
    @RetryableTopic(attempts="8", backoff=@Backoff(delay=2000, multiplier=2, maxDelay=30000), numPartitions="3", replicationFactor="1")
    @KafkaListener(topics="sgologic.orders", groupId="sgologic-orders")
    public void orders(String value) {
        Long id=Long.valueOf(value);
        if (!pending("integration.outbox", id)) return;
        OutboxEvent e=outbox.findById(id);
        if ((e.eventType().equals("OrderPaid") || e.eventType().equals("OrderInvoiced") || e.eventType().equals("ShipmentGuideRequested"))
                && Boolean.TRUE.equals(jdbc.queryForObject("select status_id in (8,9) from orders.purchase_order where id=?",Boolean.class,e.longValue("orderId")))) {
            outbox.markDelivered(id,e.attempts()); return;
        }
        OutboxHandler handler=handlers.get(e.eventType());
        if(handler==null) throw new IllegalStateException("No handler for " + e.eventType());
        try { handler.handle(e); outbox.markDelivered(id, e.attempts()+1); }
        catch(RuntimeException error) {
            jdbc.update("update integration.outbox set attempts=attempts+1, last_error=? where id=?", trim(error), id);
            throw error;
        }
    }
    @RetryableTopic(attempts="8", backoff=@Backoff(delay=2000, multiplier=2, maxDelay=30000), numPartitions="3", replicationFactor="1")
    @KafkaListener(topics="sgologic.notifications", groupId="sgologic-notifications")
    public void notifications(String value) { deliver("notifications.notification",Long.valueOf(value),() -> notifications.deliverOne(Long.valueOf(value))); }
    @RetryableTopic(attempts="8", backoff=@Backoff(delay=2000, multiplier=2, maxDelay=30000), numPartitions="3", replicationFactor="1")
    @KafkaListener(topics="sgologic.pos", groupId="sgologic-pos")
    public void pos(String value) { deliver("integration.pos_event",Long.valueOf(value),() -> pos.deliverOne(Long.valueOf(value))); }
    @RetryableTopic(attempts="8", backoff=@Backoff(delay=2000, multiplier=2, maxDelay=30000), numPartitions="3", replicationFactor="1")
    @KafkaListener(topics="sgologic.erp", groupId="sgologic-erp")
    public void erp(String value) { deliver("integration.erp_batch",Long.valueOf(value),() -> erp.deliverOne(Long.valueOf(value))); }

    @DltHandler
    public void deadLetter(org.apache.kafka.clients.consumer.ConsumerRecord<String,String> record) {
        Long id=Long.valueOf(record.value());
        String topic=record.topic();
        String table=topic.startsWith("sgologic.orders") ? "integration.outbox" :
            topic.startsWith("sgologic.notifications") ? "notifications.notification" :
            topic.startsWith("sgologic.pos") ? "integration.pos_event" : "integration.erp_batch";
        if (!pending(table, id)) return;
        jdbc.update("update " + table + " set status_id=3 where id=?", id);
        if(table.equals("integration.outbox")) {
            OutboxEvent e=outbox.findById(id);
            OutboxHandler h=handlers.get(e.eventType());
            if(h!=null) h.onRetriesExhausted(e, "Kafka: reintentos agotados; revisar proveedor");
        }
    }
    private void deliver(String table,Long id,Runnable handler) {
        try { handler.run(); }
        catch(RuntimeException error) {
            // This runs after a service transaction rolled back, preserving each failed attempt.
            jdbc.update("update "+table+" set attempts=attempts+1,last_error=? where id=? and status_id=1",trim(error),id);
            throw error;
        }
    }
    private boolean pending(String table, Long id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select status_id=1 from " + table + " where id=?", Boolean.class, id));
    }
    private static String trim(Exception e) { String s=e.getMessage(); return s==null ? e.getClass().getSimpleName() : s.substring(0,Math.min(500,s.length())); }
}
