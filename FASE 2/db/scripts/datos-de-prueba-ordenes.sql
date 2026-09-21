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

begin;

do $$ begin perform setseed(0.42); end $$;

-- Órdenes: estado, canal, cliente y lugar desde donde se despacha.
-- Las órdenes abiertas son de los últimos 10 minutos para que su reserva siga vigente.
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
select n + (select coalesce(max(id), 0) from orders.purchase_order) as id,
       n + (select coalesce(max(id), 0) from orders.cart) as cart_id,
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
cross join (select array_agg(id order by id) as ids from customers.customer) cu
cross join (select array_agg(id order by id) as ids from inventory.location where type = 'DISTRIBUTION_CENTER') cds
cross join (select array_agg(id order by id) as ids from inventory.location where type = 'STORE') st;

alter table t_order add column total numeric(12,2);

-- Cada orden lleva de 1 a 3 productos distintos, de 1 o 2 unidades cada uno.
create temp table t_item on commit drop as
select o.id as order_id, p.id as product_id, p.price as unit_price,
       1 + floor(random() * 2)::int as quantity
from t_order o
cross join lateral (
    select id, price from catalog.product where active order by random() limit o.items_count
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
    join inventory.stock s on s.location_id = u.location_id and s.product_id = u.product_id
    where u.sold + s.reserved + u.held > s.on_hand
),
moved as (
    insert into inventory.stock_movement (location_id, product_id, kind, quantity, reason)
    select location_id, product_id, 'IN', restock, 'Reposición para los datos de prueba' from need
)
update inventory.stock s
set on_hand = s.on_hand + n.restock, updated_at = now()
from need n
where s.location_id = n.location_id and s.product_id = n.product_id;

update inventory.stock s
set on_hand = s.on_hand - u.sold, reserved = s.reserved + u.held, updated_at = now()
from t_use u
where s.location_id = u.location_id and s.product_id = u.product_id;

insert into inventory.stock_movement (location_id, product_id, kind, quantity, reason, reference, created_at)
select o.origin_id, i.product_id, 'OUT', i.quantity, 'Venta', 'ORD-' || o.id, o.created_at
from t_item i
join t_order o on o.id = i.order_id
where o.is_paid;

-- Carritos convertidos, órdenes y sus ítems

insert into orders.cart (id, customer_id, last_channel, status, created_at, updated_at)
overriding system value
select cart_id, customer_id, channel, 'CONVERTED', created_at - interval '5 minutes', created_at
from t_order;

insert into orders.cart_item (cart_id, product_id, quantity, unit_price)
select o.cart_id, i.product_id, i.quantity, i.unit_price
from t_item i
join t_order o on o.id = i.order_id;

insert into orders.purchase_order (id, cart_id, customer_id, channel, status, total, created_at, updated_at)
overriding system value
select id, cart_id, customer_id, channel, status, total, created_at,
       least(now(), created_at + case
           when status in ('DELIVERED', 'RETURNED') then interval '1 day'
           when status = 'IN_DISPATCH' then interval '2 hours'
           when status = 'INVOICED' then interval '10 minutes'
           else interval '1 minute' end)
from t_order;

insert into orders.order_item (order_id, product_id, quantity, unit_price)
select order_id, product_id, quantity, unit_price from t_item;

do $$
begin
    perform setval(pg_get_serial_sequence('orders.cart', 'id'), (select max(id) from orders.cart));
    perform setval(pg_get_serial_sequence('orders.purchase_order', 'id'), (select max(id) from orders.purchase_order));
end $$;

-- Reservas. Las órdenes abiertas la tienen activa; las pagadas, confirmada;
-- las canceladas, vencida o liberada.
insert into inventory.reservation (order_id, location_id, product_id, quantity, status, created_at, expires_at, closed_at)
select o.id, o.origin_id, i.product_id, i.quantity, r.status, o.created_at, r.expires_at,
       case r.status
           when 'ACTIVE' then null
           when 'EXPIRED' then r.expires_at
           else o.created_at + interval '20 seconds' end
from t_item i
join t_order o on o.id = i.order_id
cross join (select coalesce((select value::int from config.setting where key = 'reservation.ttl_minutes'), 15) as ttl) t
cross join lateral (
    select case when o.is_open then 'ACTIVE'
                when o.is_paid then 'CONFIRMED'
                when o.status = 'PAYMENT_FAILED' then 'RELEASED'
                when o.n % 2 = 0 then 'EXPIRED'
                else 'RELEASED' end as status,
           o.created_at + make_interval(mins => t.ttl) as expires_at
) r;

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
insert into payments.payment_attempt
    (order_id, channel, attempt_number, result, amount, provider_reference, card_last4, failure_reason, latency_ms, attempted_at)
select o.id, o.channel, p.num, p.result, o.total,
       case when p.result = 'APPROVED' then 'PK-' || lpad(o.id::text, 8, '0') end,
       lpad(((o.id * 7919) % 10000)::text, 4, '0'),
       p.reason, p.latency, least(now(), o.created_at + p.delay)
from plan p
join t_order o on o.id = p.order_id;

-- Facturas. Las que aún esperan a la SAT quedan en GENERATED o SENT.
insert into invoicing.invoice (order_id, cui, series, xml, status, sat_response, generated_at, answered_at)
select o.id, x.cui, 'FACT-A',
       format('<?xml version="1.0" encoding="UTF-8"?><factura><cui>%s</cui><serie>FACT-A</serie><orden>%s</orden><total>%s</total></factura>',
              x.cui, o.id, o.total),
       x.status,
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
where o.is_invoiced;

-- Envíos. Cerca del 2% de las guías en despacho quedan sin número porque LogiExpress no respondió.
insert into logistics.shipment
    (order_id, origin_location_id, delivery_address, tracking_number, status, created_at, updated_at)
select o.id, o.origin_id, c.address,
       case when g.guide_failed then null else 'LX-' || lpad(o.id::text, 8, '0') end,
       case when g.guide_failed then 'GUIDE_REQUESTED'
            when o.status = 'IN_DISPATCH' then case when o.n % 2 = 0 then 'IN_TRANSIT' else 'GUIDE_ISSUED' end
            else 'DELIVERED' end,
       o.created_at + interval '2 minutes',
       least(now(), o.created_at + case when o.status = 'IN_DISPATCH' then interval '10 minutes' else interval '1 day' end)
from t_order o
join customers.customer c on c.id = o.customer_id
cross join lateral (select o.status = 'IN_DISPATCH' and o.n % 50 = 0 as guide_failed) g
where o.is_shipped;

insert into logistics.tracking_event (shipment_id, status, detail, occurred_at)
select s.id, 'GUIDE_ISSUED', 'Guía emitida por LogiExpress', s.created_at + interval '1 minute'
from logistics.shipment s
where s.order_id in (select id from t_order) and s.tracking_number is not null
union all
select s.id, 'IN_TRANSIT', 'El paquete salió hacia su destino', least(now(), s.created_at + interval '3 hours')
from logistics.shipment s
where s.order_id in (select id from t_order) and s.status in ('IN_TRANSIT', 'DELIVERED')
union all
select s.id, 'DELIVERED', 'Entregado al cliente', s.updated_at
from logistics.shipment s
where s.order_id in (select id from t_order) and s.status = 'DELIVERED';

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
insert into notifications.notification
    (order_id, channel, recipient, message, status, attempts, last_error, created_at, sent_at)
select m.order_id,
       case o.channel when 'WEB' then 'EMAIL' when 'MOBILE' then 'PUSH' else 'SMS' end,
       case o.channel when 'WEB' then c.email when 'MOBILE' then 'dispositivo-' || c.id else c.phone end,
       m.message,
       case when o.n % 20 = 0 then 'FAILED' else 'SENT' end,
       case when o.n % 20 = 0 then 3 else 1 end,
       case when o.n % 20 = 0 then 'Proveedor de mensajería no disponible' end,
       m.ts,
       case when o.n % 20 <> 0 then m.ts + interval '2 seconds' end
from msg m
join t_order o on o.id = m.order_id
join customers.customer c on c.id = o.customer_id;

-- Incidencias: toda orden devuelta y una de cada 25 entregadas.
insert into orders.incident (order_id, kind, description, status, created_at, resolved_at)
select o.id, x.kind, x.description, x.status,
       least(now(), o.created_at + interval '1 day'),
       case when x.status = 'RESOLVED' then least(now(), o.created_at + interval '30 hours') end
from t_order o
cross join lateral (
    select case when o.status = 'RETURNED' or o.n % 2 = 1 then 'RETURN' else 'EXCHANGE' end as kind,
           case o.n % 3 when 0 then 'Producto con defecto de fábrica'
                        when 1 then 'No era lo que el cliente esperaba'
                        else 'Llegó con el empaque dañado' end as description,
           case when o.status = 'RETURNED' then 'RESOLVED'
                when o.n % 3 = 0 then 'REGISTERED'
                when o.n % 3 = 1 then 'IN_PROCESS'
                else 'RESOLVED' end as status
) x
where o.status = 'RETURNED' or (o.status = 'DELIVERED' and o.n % 25 = 0);

-- Outbox: cobros por reintentar y eventos de órdenes pagadas ya procesados.
insert into integration.outbox
    (aggregate_type, aggregate_id, event_type, payload, status, attempts, next_attempt_at, last_error, created_at, processed_at)
select 'order', o.id, 'PAYMENT_RETRY',
       jsonb_build_object('orderId', o.id, 'amount', o.total, 'attempt', 2),
       'PENDING', 1, now() + interval '1 minute', 'Latencia mayor a 5 segundos', o.created_at, null
from t_order o where o.status = 'PAYMENT_IN_PROGRESS'
union all
select 'order', o.id, 'ORDER_PAID',
       jsonb_build_object('orderId', o.id, 'total', o.total, 'channel', o.channel),
       'PROCESSED', 1, o.created_at, null, o.created_at, least(now(), o.created_at + interval '5 seconds')
from t_order o where o.is_paid;

-- Eventos hacia el POS de las tiendas que despachan. Algunos no llegaron por fallas de red.
insert into integration.pos_event
    (store_id, event_type, payload, status, attempts, next_attempt_at, last_error, created_at, delivered_at)
select o.origin_id, 'SALE_CONFIRMED',
       jsonb_build_object('orderId', o.id, 'total', o.total),
       s.status,
       case s.status when 'DEAD' then 5 when 'PENDING' then 2 else 1 end,
       case s.status when 'PENDING' then now() + interval '2 minutes' else o.created_at end,
       case when s.status <> 'DELIVERED' then 'Sin conexión con la tienda' end,
       o.created_at,
       case when s.status = 'DELIVERED' then o.created_at + interval '3 seconds' end
from t_order o
join inventory.location l on l.id = o.origin_id and l.type = 'STORE'
cross join lateral (
    select case when o.n % 25 = 0 then 'DEAD'
                when o.n % 10 = 1 and o.created_at > now() - interval '2 hours' then 'PENDING'
                else 'DELIVERED' end as status
) s
where o.is_paid;

-- Lotes del ERP: una orden pagada entra al lote de su ventana de 30 minutos, solo si esa ventana ya cerró.
create temp table t_erp on commit drop as
select o.id as order_id, o.total,
       date_bin(interval '30 minutes', o.created_at, timestamptz '2000-01-01 00:00:00+00') as window_start
from t_order o
where o.is_paid;

delete from t_erp where window_start + interval '30 minutes' > now();

with batch as (
    insert into integration.erp_batch as b
        (window_start, window_end, format, file_name, order_count, total_amount, status, created_at, sent_at)
    select window_start, window_start + interval '30 minutes', 'CSV',
           'ventas_' || to_char(window_start at time zone 'UTC', 'YYYYMMDD_HH24MI') || '.csv',
           count(*), sum(total), 'SENT',
           least(now(), window_start + interval '31 minutes'),
           least(now(), window_start + interval '32 minutes')
    from t_erp
    group by window_start
    on conflict (window_start, window_end) do update
        set order_count = b.order_count + excluded.order_count,
            total_amount = b.total_amount + excluded.total_amount
    returning b.id, b.window_start
)
insert into integration.erp_batch_order (order_id, batch_id)
select e.order_id, batch.id
from t_erp e
join batch on batch.window_start = e.window_start;

-- Auditoría de todo lo anterior, con el orden y el canal para poder consultarla rápido.
insert into audit.audit_log (occurred_at, actor, action, entity_type, entity_id, order_id, channel, details)
select o.created_at,
       case when o.channel = 'CALL_CENTER' then 'agente-' || (1 + o.n % 5) else 'cliente-' || o.customer_id end,
       'ORDER_CREATED', 'order', o.id::text, o.id, o.channel,
       jsonb_build_object('total', o.total, 'items', o.items_count)
from t_order o
union all
select r.created_at, 'inventory-service', 'STOCK_RESERVED', 'reservation', r.id::text, r.order_id, o.channel,
       jsonb_build_object('productId', r.product_id, 'locationId', r.location_id, 'quantity', r.quantity)
from inventory.reservation r
join t_order o on o.id = r.order_id
union all
select a.attempted_at, 'payment-service', 'PAYMENT_' || a.result, 'payment_attempt', a.id::text, a.order_id, a.channel,
       jsonb_build_object('attempt', a.attempt_number, 'amount', a.amount, 'latencyMs', a.latency_ms,
                          'reference', a.provider_reference)
from payments.payment_attempt a
where a.order_id in (select id from t_order)
union all
select i.generated_at, 'invoicing-service', 'INVOICE_' || i.status, 'invoice', i.id::text, i.order_id, o.channel,
       jsonb_build_object('cui', i.cui, 'series', i.series)
from invoicing.invoice i
join t_order o on o.id = i.order_id
union all
select s.created_at, 'logistics-service', 'SHIPMENT_' || s.status, 'shipment', s.id::text, s.order_id, o.channel,
       jsonb_build_object('originLocationId', s.origin_location_id, 'tracking', s.tracking_number)
from logistics.shipment s
join t_order o on o.id = s.order_id
union all
select n.created_at, 'notification-service', 'NOTIFICATION_' || n.status, 'notification', n.id::text, n.order_id, o.channel,
       jsonb_build_object('channel', n.channel)
from notifications.notification n
join t_order o on o.id = n.order_id;

-- Algunos clientes con carrito abierto, de un canal cualquiera, para probar el carrito unificado.
with c as (
    insert into orders.cart (customer_id, last_channel, status, created_at, updated_at)
    select cu.id, (array['WEB', 'MOBILE', 'CALL_CENTER'])[1 + floor(random() * 3)::int], 'OPEN',
           now() - random() * interval '2 hours', now()
    from customers.customer cu
    where random() < 0.15
      and not exists (select 1 from orders.cart k
                      where k.customer_id = cu.id and k.status in ('OPEN', 'IN_CHECKOUT'))
    returning id
)
insert into orders.cart_item (cart_id, product_id, quantity, unit_price)
select c.id, p.id, 1 + floor(random() * 2)::int, p.price
from c
cross join lateral (
    select id, price from catalog.product where active order by random() limit 1 + (c.id % 3)
) p;

\echo 'Datos cargados en esta corrida:'
select o.status as estado, count(*) as ordenes
from t_order o
group by o.status
order by count(*) desc;

commit;
