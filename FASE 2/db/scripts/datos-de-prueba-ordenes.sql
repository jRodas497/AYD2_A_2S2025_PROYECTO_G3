-- Carga órdenes de ejemplo con todo lo que las rodea: reservas, pagos, facturas,
-- envíos, notificaciones, outbox, lotes del ERP y auditoría.
-- Cada corrida agrega datos nuevos, no borra los anteriores.
--
-- Uso: psql -v ordenes=500 -f datos-de-prueba-ordenes.sql   (sin -v se cargan 200)

\if :{?ordenes}
\else
    \set ordenes 200
\endif
\set ON_ERROR_STOP on

set search_path = config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications, integration, audit;

begin;

do $$ begin perform setseed(0.42); end $$;

-- Órdenes: estado, canal, cliente y lugar desde donde se despacha.
-- Las órdenes abiertas son de los últimos 10 minutos para que su reserva siga vigente.
-- Aquí estado y canal van como código; se convierten a id al insertar en las tablas reales.
create temp table t_order on commit drop as
with base as (
    select n,
           random() as r_status, random() as r_channel, random() as r_time,
           random() as r_place, random() as r_slow
    from generate_series(1, :ordenes) as n
),
typed as (
    select b.*,
           case when r_status < 0.30 then 'DELIVERED'
                when r_status < 0.45 then 'IN_DISPATCH'
                when r_status < 0.57 then 'INVOICED'
                when r_status < 0.67 then 'PAID'
                when r_status < 0.70 then 'RETURNED'
                when r_status < 0.75 then 'PAYMENT_IN_PROGRESS'
                when r_status < 0.82 then 'PAYMENT_FAILED'
                when r_status < 0.90 then 'CANCELLED'
                else 'PENDING_PAYMENT' end as status,
           case when r_channel < 0.45 then 'WEB'
                when r_channel < 0.85 then 'MOBILE'
                else 'CALL_CENTER' end as channel
    from base b
),
ranged as (
    select t.*, r.lo, r.hi
    from typed t
    join (values ('DELIVERED', 172800, 604800),
                 ('RETURNED', 172800, 604800),
                 ('IN_DISPATCH', 14400, 172800),
                 ('INVOICED', 1800, 14400),
                 ('PAID', 300, 7200),
                 ('PAYMENT_IN_PROGRESS', 0, 600),
                 ('PENDING_PAYMENT', 0, 600),
                 ('PAYMENT_FAILED', 0, 604800),
                 ('CANCELLED', 0, 604800)) as r (status, lo, hi)
      on r.status = t.status
)
select n + (select coalesce(max(id), 0) from purchase_order) as id,
       n + (select coalesce(max(id), 0) from cart) as cart_id,
       n, status, channel,
       status in ('PAID', 'INVOICED', 'IN_DISPATCH', 'DELIVERED', 'RETURNED') as is_paid,
       status in ('INVOICED', 'IN_DISPATCH', 'DELIVERED', 'RETURNED') as is_invoiced,
       status in ('IN_DISPATCH', 'DELIVERED', 'RETURNED') as is_shipped,
       status in ('PENDING_PAYMENT', 'PAYMENT_IN_PROGRESS') as is_open,
       r_slow < 0.10 as slow_payment,
       cu.ids[1 + floor(random() * cardinality(cu.ids))::int] as customer_id,
       case when r_place < 0.70
            then cds.ids[1 + floor(random() * cardinality(cds.ids))::int]
            else st.ids[1 + floor(random() * cardinality(st.ids))::int] end as origin_id,
       1 + floor(random() * 3)::int as items_count,
       now() - make_interval(secs => lo + r_time * (hi - lo)) as created_at
from ranged
cross join (select array_agg(id order by id) as ids from customer) cu
cross join (select array_agg(l.id order by l.id) as ids
            from location l join location_type t on t.id = l.type_id
            where t.code = 'DISTRIBUTION_CENTER') cds
cross join (select array_agg(l.id order by l.id) as ids
            from location l join location_type t on t.id = l.type_id
            where t.code = 'STORE') st;

alter table t_order add column total numeric(12,2);

-- Cada orden lleva de 1 a 3 productos distintos, de 1 o 2 unidades cada uno.
create temp table t_item on commit drop as
select o.id as order_id, p.id as product_id, p.price as unit_price,
       1 + floor(random() * 2)::int as quantity
from t_order o
cross join lateral (
    select id, price from product where active order by random() limit o.items_count
) p;

update t_order o
set total = (select sum(i.quantity * i.unit_price) from t_item i where i.order_id = o.id);

-- Stock: se repone lo que haga falta en cada lugar y luego se aplican ventas y reservas,
-- para que el stock siga cuadrando con los movimientos.
create temp table t_use on commit drop as
select o.origin_id as location_id, i.product_id,
       coalesce(sum(i.quantity) filter (where o.is_paid), 0) as sold,
       coalesce(sum(i.quantity) filter (where o.is_open), 0) as held
from t_item i
join t_order o on o.id = i.order_id
group by o.origin_id, i.product_id;

with need as (
    select u.location_id, u.product_id, u.sold + s.reserved + u.held - s.on_hand as restock
    from t_use u
    join stock s on s.location_id = u.location_id and s.product_id = u.product_id
    where u.sold + s.reserved + u.held > s.on_hand
),
moved as (
    insert into stock_movement (location_id, product_id, type_id, quantity, reason)
    select n.location_id, n.product_id, m.id, n.restock, 'Reposición para los datos de prueba'
    from need n
    cross join (select id from movement_type where code = 'IN') m
)
update stock s
set on_hand = s.on_hand + n.restock, updated_at = now()
from need n
where s.location_id = n.location_id and s.product_id = n.product_id;

update stock s
set on_hand = s.on_hand - u.sold, reserved = s.reserved + u.held, updated_at = now()
from t_use u
where s.location_id = u.location_id and s.product_id = u.product_id;

-- Carritos convertidos, órdenes y sus ítems

insert into cart (id, customer_id, last_channel_id, status_id, created_at, updated_at)
overriding system value
select o.cart_id, o.customer_id, ch.id, cs.id, o.created_at - interval '5 minutes', o.created_at
from t_order o
join channel ch on ch.code = o.channel
cross join (select id from cart_status where code = 'CONVERTED') cs;

insert into cart_item (cart_id, product_id, quantity)
select o.cart_id, i.product_id, i.quantity
from t_item i
join t_order o on o.id = i.order_id;

insert into purchase_order
    (id, cart_id, customer_id, channel_id, status_id, total, delivery_address, created_at, updated_at)
overriding system value
select o.id, o.cart_id, o.customer_id, ch.id, s.id, o.total, c.address, o.created_at,
       least(now(), o.created_at + case
           when o.status in ('DELIVERED', 'RETURNED') then interval '1 day'
           when o.status = 'IN_DISPATCH' then interval '2 hours'
           when o.status = 'INVOICED' then interval '10 minutes'
           else interval '1 minute' end)
from t_order o
join customer c on c.id = o.customer_id
join channel ch on ch.code = o.channel
join order_status s on s.code = o.status;

insert into order_item (order_id, product_id, quantity, unit_price)
select order_id, product_id, quantity, unit_price from t_item;

insert into stock_movement (location_id, product_id, type_id, quantity, reason, order_id, created_at)
select o.origin_id, i.product_id, m.id, i.quantity, 'Venta', o.id, o.created_at
from t_item i
join t_order o on o.id = i.order_id
cross join (select id from movement_type where code = 'OUT') m
where o.is_paid;

do $$
begin
    perform setval(pg_get_serial_sequence('orders.cart', 'id'), (select max(id) from cart));
    perform setval(pg_get_serial_sequence('orders.purchase_order', 'id'), (select max(id) from purchase_order));
end $$;

-- Reservas. Las órdenes abiertas la tienen activa; las pagadas, confirmada;
-- las canceladas, vencida o liberada.
insert into reservation (order_id, location_id, product_id, quantity, status_id, created_at, expires_at, closed_at)
select o.id, o.origin_id, i.product_id, i.quantity, rs.id, o.created_at, r.expires_at,
       case r.status
           when 'ACTIVE' then null
           when 'EXPIRED' then r.expires_at
           else o.created_at + interval '20 seconds' end
from t_item i
join t_order o on o.id = i.order_id
cross join (select coalesce((select value::int from setting where key = 'reservation.ttl_minutes'), 15) as ttl) t
cross join lateral (
    select case when o.is_open then 'ACTIVE'
                when o.is_paid then 'CONFIRMED'
                when o.status = 'PAYMENT_FAILED' then 'RELEASED'
                when o.n % 2 = 0 then 'EXPIRED'
                else 'RELEASED' end as status,
           o.created_at + make_interval(mins => t.ttl) as expires_at
) r
join reservation_status rs on rs.code = r.status;

-- Intentos de cobro. Algunos pagos tardan más de 5 segundos: primero un timeout y luego el reintento aprobado.
with plan as (
    select o.id as order_id, 1 as num, 'APPROVED' as result,
           (300 + floor(random() * 1200))::int as latency, null::text as reason,
           interval '5 seconds' as delay
    from t_order o where o.is_paid and not o.slow_payment
    union all
    select o.id, 1, 'TIMEOUT', (5000 + floor(random() * 3000))::int,
           'Latencia mayor a 5 segundos', interval '6 seconds'
    from t_order o where o.is_paid and o.slow_payment
    union all
    select o.id, 2, 'APPROVED', (400 + floor(random() * 800))::int, null, interval '3 minutes'
    from t_order o where o.is_paid and o.slow_payment
    union all
    select o.id, 1, 'TIMEOUT', (5000 + floor(random() * 3000))::int,
           'Latencia mayor a 5 segundos', interval '6 seconds'
    from t_order o where o.status = 'PAYMENT_IN_PROGRESS'
    union all
    select o.id, 1, 'DECLINED', (500 + floor(random() * 1000))::int,
           case when o.n % 2 = 0 then 'Fondos insuficientes' else 'Tarjeta rechazada por el banco' end,
           interval '5 seconds'
    from t_order o where o.status = 'PAYMENT_FAILED'
)
insert into payment_attempt
    (order_id, attempt_number, result_id, amount, provider_reference, card_last4, failure_reason, latency_ms, attempted_at)
select o.id, p.num, r.id, o.total,
       case when p.result = 'APPROVED' then 'PK-' || lpad(o.id::text, 8, '0') end,
       lpad(((o.id * 7919) % 10000)::text, 4, '0'),
       p.reason, p.latency, least(now(), o.created_at + p.delay)
from plan p
join t_order o on o.id = p.order_id
join payment_result r on r.code = p.result;

-- Facturas. Las que aún esperan a la SAT quedan en GENERATED o SENT.
insert into invoice (order_id, status_id, cui, series, xml, sat_response, generated_at, answered_at)
select o.id, s.id, x.cui, 'FACT-A',
       format('<?xml version="1.0" encoding="UTF-8"?><factura><cui>%s</cui><serie>FACT-A</serie><orden>%s</orden><total>%s</total></factura>',
              x.cui, o.id, o.total),
       case when x.status = 'ACCEPTED' then 'Documento aprobado por la SAT' end,
       o.created_at + interval '30 seconds',
       case when x.status = 'ACCEPTED' then least(now(), o.created_at + interval '50 seconds') end
from t_order o
cross join lateral (
    select 'DEMO-' || upper(substr(md5(o.id::text), 1, 12)) as cui,
           case when o.status <> 'INVOICED' then 'ACCEPTED'
                when o.n % 10 < 2 then 'GENERATED'
                when o.n % 10 < 5 then 'SENT'
                else 'ACCEPTED' end as status
) x
join invoice_status s on s.code = x.status
where o.is_invoiced;

-- Envíos. Cerca del 2% de las guías en despacho quedan sin número porque LogiExpress no respondió.
insert into shipment
    (order_id, origin_location_id, carrier_id, status_id, tracking_number, created_at, updated_at)
select o.id, o.origin_id, cr.id, s.id,
       case when g.guide_failed then null else 'LX-' || lpad(o.id::text, 8, '0') end,
       o.created_at + interval '2 minutes',
       least(now(), o.created_at + case when o.status = 'IN_DISPATCH' then interval '10 minutes' else interval '1 day' end)
from t_order o
cross join lateral (select o.status = 'IN_DISPATCH' and o.n % 50 = 0 as guide_failed) g
cross join lateral (
    select case when g.guide_failed then 'GUIDE_REQUESTED'
                when o.status = 'IN_DISPATCH' then case when o.n % 2 = 0 then 'IN_TRANSIT' else 'GUIDE_ISSUED' end
                else 'DELIVERED' end as status
) st
join shipment_status s on s.code = st.status
cross join (select id from carrier where code = 'LOGIEXPRESS') cr
where o.is_shipped;

insert into tracking_event (shipment_id, status_id, detail, occurred_at)
select s.id, ts.id, e.detail, e.happened_at
from shipment s
join shipment_status ss on ss.id = s.status_id
cross join lateral (
    values ('GUIDE_ISSUED', 'Guía emitida por LogiExpress', s.created_at + interval '1 minute', s.tracking_number is not null),
           ('IN_TRANSIT', 'El paquete salió hacia su destino', least(now(), s.created_at + interval '3 hours'),
                ss.code in ('IN_TRANSIT', 'DELIVERED')),
           ('DELIVERED', 'Entregado al cliente', s.updated_at, ss.code = 'DELIVERED')
) as e (status, detail, happened_at, applies)
join shipment_status ts on ts.code = e.status
where s.order_id in (select id from t_order) and e.applies;

-- Notificaciones. Una de cada veinte falla porque el proveedor de mensajería no responde.
with msg as (
    select o.id as order_id, format('Tu orden #%s fue confirmada', o.id) as message,
           o.created_at + interval '10 seconds' as ts
    from t_order o where o.is_paid
    union all
    select o.id, format('Tu orden #%s va en camino', o.id), o.created_at + interval '2 minutes'
    from t_order o where o.is_shipped
    union all
    select o.id, format('Tu orden #%s fue entregada', o.id), least(now(), o.created_at + interval '1 day')
    from t_order o where o.status in ('DELIVERED', 'RETURNED')
    union all
    select o.id, format('No pudimos procesar el pago de tu orden #%s', o.id), o.created_at + interval '10 seconds'
    from t_order o where o.status = 'PAYMENT_FAILED'
)
insert into notification
    (order_id, channel_id, status_id, recipient, message, attempts, last_error, created_at, sent_at)
select m.order_id, nc.id, ds.id,
       case o.channel when 'WEB' then c.email when 'MOBILE' then 'dispositivo-' || c.id else c.phone end,
       m.message,
       case when o.n % 20 = 0 then 3 else 1 end,
       case when o.n % 20 = 0 then 'Proveedor de mensajería no disponible' end,
       m.ts,
       case when o.n % 20 <> 0 then m.ts + interval '2 seconds' end
from msg m
join t_order o on o.id = m.order_id
join customer c on c.id = o.customer_id
join notification_channel nc on nc.code = case o.channel when 'WEB' then 'EMAIL' when 'MOBILE' then 'PUSH' else 'SMS' end
join delivery_status ds on ds.code = case when o.n % 20 = 0 then 'FAILED' else 'DELIVERED' end;

-- Incidencias: toda orden devuelta y una de cada 25 entregadas.
insert into incident (order_id, type_id, status_id, description, created_at, resolved_at)
select o.id, it.id, ist.id, x.description,
       least(now(), o.created_at + interval '1 day'),
       case when x.status = 'RESOLVED' then least(now(), o.created_at + interval '30 hours') end
from t_order o
cross join lateral (
    select case when o.status = 'RETURNED' or o.n % 2 = 1 then 'RETURN' else 'EXCHANGE' end as type,
           case o.n % 3 when 0 then 'Producto con defecto de fábrica'
                        when 1 then 'No era lo que el cliente esperaba'
                        else 'Llegó con el empaque dañado' end as description,
           case when o.status = 'RETURNED' then 'RESOLVED'
                when o.n % 3 = 0 then 'REGISTERED'
                when o.n % 3 = 1 then 'IN_PROCESS'
                else 'RESOLVED' end as status
) x
join incident_type it on it.code = x.type
join incident_status ist on ist.code = x.status
where o.status = 'RETURNED' or (o.status = 'DELIVERED' and o.n % 25 = 0);

-- Outbox: cobros por reintentar y eventos de órdenes pagadas ya procesados.
insert into outbox
    (aggregate_type, aggregate_id, event_type, payload, status_id, attempts, next_attempt_at, last_error, created_at, processed_at)
select x.aggregate_type, x.aggregate_id, x.event_type, x.payload, ds.id, x.attempts,
       x.next_attempt_at, x.last_error, x.created_at, x.processed_at
from (
    select 'order' as aggregate_type, o.id as aggregate_id, 'PAYMENT_RETRY' as event_type,
           jsonb_build_object('orderId', o.id, 'amount', o.total, 'attempt', 2) as payload,
           'PENDING' as status, 1 as attempts, now() + interval '1 minute' as next_attempt_at,
           'Latencia mayor a 5 segundos' as last_error, o.created_at, null::timestamptz as processed_at
    from t_order o where o.status = 'PAYMENT_IN_PROGRESS'
    union all
    select 'order', o.id, 'ORDER_PAID',
           jsonb_build_object('orderId', o.id, 'total', o.total, 'channel', o.channel),
           'DELIVERED', 1, o.created_at, null, o.created_at, least(now(), o.created_at + interval '5 seconds')
    from t_order o where o.is_paid
) x
join delivery_status ds on ds.code = x.status;

-- Eventos hacia el POS de las tiendas que despachan. Algunos no llegaron por fallas de red.
insert into pos_event
    (store_id, event_type, payload, status_id, attempts, next_attempt_at, last_error, created_at, delivered_at)
select o.origin_id, 'SALE_CONFIRMED',
       jsonb_build_object('orderId', o.id, 'total', o.total),
       ds.id,
       case s.status when 'FAILED' then 5 when 'PENDING' then 2 else 1 end,
       case s.status when 'PENDING' then now() + interval '2 minutes' else o.created_at end,
       case when s.status <> 'DELIVERED' then 'Sin conexión con la tienda' end,
       o.created_at,
       case when s.status = 'DELIVERED' then o.created_at + interval '3 seconds' end
from t_order o
join location l on l.id = o.origin_id
join location_type lt on lt.id = l.type_id and lt.code = 'STORE'
cross join lateral (
    select case when o.n % 25 = 0 then 'FAILED'
                when o.n % 10 = 1 and o.created_at > now() - interval '2 hours' then 'PENDING'
                else 'DELIVERED' end as status
) s
join delivery_status ds on ds.code = s.status
where o.is_paid;

-- Lotes del ERP: una orden pagada entra al lote de su ventana de 30 minutos, solo si esa ventana ya cerró.
create temp table t_erp on commit drop as
select o.id as order_id,
       date_bin(interval '30 minutes', o.created_at, timestamptz '2000-01-01 00:00:00+00') as window_start
from t_order o
where o.is_paid;

delete from t_erp where window_start + interval '30 minutes' > now();

with batch as (
    insert into erp_batch as b
        (window_start, window_end, format_id, status_id, file_name, created_at, sent_at)
    select w.window_start, w.window_start + interval '30 minutes', f.id, ds.id,
           'ventas_' || to_char(w.window_start at time zone 'UTC', 'YYYYMMDD_HH24MI') || '.csv',
           least(now(), w.window_start + interval '31 minutes'),
           least(now(), w.window_start + interval '32 minutes')
    from (select distinct window_start from t_erp) w
    cross join (select id from file_format where code = 'CSV') f
    cross join (select id from delivery_status where code = 'DELIVERED') ds
    on conflict (window_start, window_end) do update
        set window_end = excluded.window_end
    returning b.id, b.window_start
)
insert into erp_batch_order (order_id, batch_id)
select e.order_id, batch.id
from t_erp e
join batch on batch.window_start = e.window_start;

-- Auditoría de todo lo anterior, con el orden y el canal para poder consultarla rápido.
insert into audit_log (occurred_at, actor, action, entity_type, entity_id, order_id, channel_id, details)
select o.created_at,
       case when o.channel = 'CALL_CENTER' then 'agente-' || (1 + o.n % 5) else 'cliente-' || o.customer_id end,
       'ORDER_CREATED', 'order', o.id::text, o.id, ch.id,
       jsonb_build_object('total', o.total, 'items', o.items_count)
from t_order o
join channel ch on ch.code = o.channel
union all
select r.created_at, 'inventory-service', 'STOCK_RESERVED', 'reservation', r.id::text, r.order_id, ch.id,
       jsonb_build_object('productId', r.product_id, 'locationId', r.location_id, 'quantity', r.quantity)
from reservation r
join t_order o on o.id = r.order_id
join channel ch on ch.code = o.channel
union all
select a.attempted_at, 'payment-service', 'PAYMENT_' || pr.code, 'payment_attempt', a.id::text, a.order_id, ch.id,
       jsonb_build_object('attempt', a.attempt_number, 'amount', a.amount, 'latencyMs', a.latency_ms,
                          'reference', a.provider_reference)
from payment_attempt a
join t_order o on o.id = a.order_id
join channel ch on ch.code = o.channel
join payment_result pr on pr.id = a.result_id
union all
select i.generated_at, 'invoicing-service', 'INVOICE_' || s.code, 'invoice', i.id::text, i.order_id, ch.id,
       jsonb_build_object('cui', i.cui, 'series', i.series)
from invoice i
join t_order o on o.id = i.order_id
join channel ch on ch.code = o.channel
join invoice_status s on s.id = i.status_id
union all
select sh.created_at, 'logistics-service', 'SHIPMENT_' || s.code, 'shipment', sh.id::text, sh.order_id, ch.id,
       jsonb_build_object('originLocationId', sh.origin_location_id, 'tracking', sh.tracking_number)
from shipment sh
join t_order o on o.id = sh.order_id
join channel ch on ch.code = o.channel
join shipment_status s on s.id = sh.status_id
union all
select n.created_at, 'notification-service', 'NOTIFICATION_' || s.code, 'notification', n.id::text, n.order_id, ch.id,
       jsonb_build_object('channel', nc.code)
from notification n
join t_order o on o.id = n.order_id
join channel ch on ch.code = o.channel
join delivery_status s on s.id = n.status_id
join notification_channel nc on nc.id = n.channel_id;

-- Algunos clientes con carrito abierto, de un canal cualquiera, para probar el carrito unificado.
with c as (
    insert into cart (customer_id, last_channel_id, status_id, created_at, updated_at)
    select cu.id, ch.id, cs.id, now() - random() * interval '2 hours', now()
    from customer cu
    cross join (select id from cart_status where code = 'OPEN') cs
    cross join lateral (select id from channel where cu.id is not null order by random() limit 1) ch
    where random() < 0.15
      and not exists (select 1 from cart k
                      join cart_status ks on ks.id = k.status_id
                      where k.customer_id = cu.id and ks.code in ('OPEN', 'IN_CHECKOUT'))
    returning id
)
insert into cart_item (cart_id, product_id, quantity)
select c.id, p.id, 1 + floor(random() * 2)::int
from c
cross join lateral (
    select id from product where active order by random() limit 1 + (c.id % 3)
) p;

\echo 'Datos cargados en esta corrida:'
select o.status as estado, count(*) as ordenes
from t_order o
group by o.status
order by count(*) desc;

commit;
