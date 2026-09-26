-- El tiempo de reserva que confirmó el equipo en la Fase 1 es de 20 minutos (CDU-01, flujo 5a, y
-- CDU-08, flujo 3). V2 lo había sembrado en 15. Se corrige con una migración nueva, no editando V2,
-- para que una base ya creada y una nueva terminen con el mismo valor.

update config.setting
set value = '20',
    description = 'Minutos que dura una reserva de stock si la compra no se concreta (CDU-01 y CDU-08)',
    updated_at = now()
where key = 'reservation.ttl_minutes';
