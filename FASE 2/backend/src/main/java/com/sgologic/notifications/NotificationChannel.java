package com.sgologic.notifications;

import com.sgologic.common.ReferenceValue;

/** notifications.notification_channel. Ids fijos, ver FASE 2/db/README.md. */
public enum NotificationChannel implements ReferenceValue {
    SMS((short) 1),
    EMAIL((short) 2),
    PUSH((short) 3);

    private final short id;

    NotificationChannel(short id) {
        this.id = id;
    }

    @Override
    public short id() {
        return id;
    }

    @Override
    public String code() {
        return name();
    }

    public static NotificationChannel fromId(short id) {
        for (NotificationChannel c : values()) {
            if (c.id == id) {
                return c;
            }
        }
        throw new IllegalArgumentException("notification_channel id desconocido: " + id);
    }
}
