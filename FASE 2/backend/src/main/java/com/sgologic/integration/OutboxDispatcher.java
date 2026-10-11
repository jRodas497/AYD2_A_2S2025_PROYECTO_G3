package com.sgologic.integration;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.LoggerFactory;

/** Relays committed database intents to Kafka. Never invokes business handlers or providers. */
@Component
public class OutboxDispatcher {
    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, String> kafka;
    public OutboxDispatcher(JdbcTemplate jdbc, KafkaTemplate<String, String> kafka) {
        this.jdbc = jdbc; this.kafka = kafka;
    }
    @Scheduled(fixedDelayString = "${sgologic.outbox.poll-fixed-delay-ms:1000}")
    public void relay() {
        for (String table : java.util.List.of("integration.outbox", "notifications.notification", "integration.pos_event", "integration.erp_batch")) {
            String topic = switch (table) {
                case "integration.outbox" -> "sgologic.orders";
                case "notifications.notification" -> "sgologic.notifications";
                case "integration.pos_event" -> "sgologic.pos";
                default -> "sgologic.erp";
            };
            var ids = jdbc.queryForList("update " + table + " set relay_lease_until = now() + interval '30 seconds' "
                    + "where id in (select id from " + table + " where status_id=1 and kafka_published_at is null "
                    + "and (relay_lease_until is null or relay_lease_until < now()) order by id limit 100 for update skip locked) returning id", Long.class);
            for (Long id : ids) {
                try {
                    kafka.send(topic, String.valueOf(id), String.valueOf(id)).get(12, java.util.concurrent.TimeUnit.SECONDS);
                    jdbc.update("update " + table + " set kafka_published_at=now(), relay_lease_until=null where id=?", id);
                } catch (Exception e) {
                    jdbc.update("update " + table + " set relay_lease_until=null where id=?", id);
                    LoggerFactory.getLogger(getClass()).warn("Kafka unavailable: intent retained in {}", table);
                    return;
                }
            }
        }
    }
}
