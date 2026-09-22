-- Red de seguridad para DC-08: aunque no exista ninguna columna para la tarjeta, un número podría
-- colarse en un texto libre o en un jsonb (un motivo de rechazo, un payload, un mensaje de error).
-- Esta función detecta números que parecen tarjeta y las restricciones de abajo los rechazan.
--
-- Detecta de 13 a 19 dígitos, juntos o en grupos separados por espacio o guion, que además
-- pasen la verificación de Luhn. Se ignoran los números pegados a letras o a otros dígitos,
-- para no confundir referencias o UUID con una tarjeta.
-- No sustituye revisar el código: es la última barrera, no la primera.

create function audit.has_card_number(t text) returns boolean
language sql immutable parallel safe as $$
    select coalesce(bool_or(
        (select sum(case when z.o % 2 = 0 then (z.d * 2) / 10 + (z.d * 2) % 10 else z.d end) % 10 = 0
         from (select d::int as d, o
               from regexp_split_to_table(reverse(regexp_replace(c.candidate, '\D', '', 'g')), '')
                    with ordinality as x (d, o)) z)
    ), false)
    from (
        select m[1] as candidate
        from regexp_matches(t, '((?<![[:alnum:]])\d{13,19}(?![[:alnum:]]))', 'g') as m
        union all
        select m[1]
        from regexp_matches(t, '((?<![[:alnum:]])\d{4}([ -])\d{4}\2\d{4}\2\d{1,7}(?![[:alnum:]]))', 'g') as m
        union all
        select m[1]
        from regexp_matches(t, '((?<![[:alnum:]])\d{4}([ -])\d{6}\2\d{5}(?![[:alnum:]]))', 'g') as m
    ) c
$$;

alter table payments.payment_attempt
    add constraint no_card_number check (not (audit.has_card_number(failure_reason) or audit.has_card_number(provider_reference)));

alter table audit.audit_log
    add constraint no_card_number check (not (audit.has_card_number(details::text) or audit.has_card_number(actor)
                                              or audit.has_card_number(action) or audit.has_card_number(entity_id)));

alter table integration.outbox
    add constraint no_card_number check (not (audit.has_card_number(payload::text) or audit.has_card_number(last_error)));

alter table integration.pos_event
    add constraint no_card_number check (not (audit.has_card_number(payload::text) or audit.has_card_number(last_error)));

alter table notifications.notification
    add constraint no_card_number check (not (audit.has_card_number(message) or audit.has_card_number(last_error)));

alter table invoicing.invoice
    add constraint no_card_number check (not audit.has_card_number(sat_response));

alter table orders.incident
    add constraint no_card_number check (not audit.has_card_number(description));

alter table inventory.stock_movement
    add constraint no_card_number check (not audit.has_card_number(reason));

alter table logistics.tracking_event
    add constraint no_card_number check (not audit.has_card_number(detail));
