-- Base de datos de SGO-Logic (PostgreSQL 16). Todo vive en el esquema public.
-- Los montos van en una sola moneda durante el MVP.
--
-- Todo dato con un conjunto fijo de valores (canal, estado, tipo) tiene su tabla de referencia
-- con id, code y name. Los ids son fijos y siguen el orden de los INSERT.

-- Tablas de referencia

create table channel (id smallint primary key, code text not null unique, name text not null);
insert into channel (id, code, name) values
    (1, 'WEB', 'Sitio web'),
    (2, 'MOBILE', 'Aplicación móvil'),
    (3, 'CALL_CENTER', 'Centro de atención telefónica');

create table product_category (id smallint primary key, code text not null unique, name text not null);
insert into product_category (id, code, name) values
    (1, 'LINEA_BLANCA', 'Línea blanca'),
    (2, 'ELECTRONICA', 'Electrónica'),
    (3, 'ROPA', 'Ropa'),
    (4, 'CALZADO', 'Calzado');

create table location_type (id smallint primary key, code text not null unique, name text not null);
insert into location_type (id, code, name) values
    (1, 'DISTRIBUTION_CENTER', 'Centro de distribución'),
    (2, 'STORE', 'Tienda');

create table cart_status (id smallint primary key, code text not null unique, name text not null);
insert into cart_status (id, code, name) values
    (1, 'OPEN', 'Abierto'),
    (2, 'IN_CHECKOUT', 'En checkout'),
    (3, 'CONVERTED', 'Convertido en orden'),
    (4, 'ABANDONED', 'Abandonado');

create table order_status (id smallint primary key, code text not null unique, name text not null);
insert into order_status (id, code, name) values
    (1, 'PENDING_PAYMENT', 'Pendiente de pago'),
    (2, 'PAYMENT_IN_PROGRESS', 'Pago en proceso'),
    (3, 'PAYMENT_FAILED', 'Pago fallido'),
    (4, 'PAID', 'Pagada'),
    (5, 'INVOICED', 'Facturada'),
    (6, 'IN_DISPATCH', 'En despacho'),
    (7, 'DELIVERED', 'Entregada'),
    (8, 'CANCELLED', 'Cancelada'),
    (9, 'RETURNED', 'Devuelta');

create table incident_type (id smallint primary key, code text not null unique, name text not null);
insert into incident_type (id, code, name) values
    (1, 'EXCHANGE', 'Cambio'),
    (2, 'RETURN', 'Devolución');

create table incident_status (id smallint primary key, code text not null unique, name text not null);
insert into incident_status (id, code, name) values
    (1, 'REGISTERED', 'Registrada'),
    (2, 'IN_PROCESS', 'En proceso'),
    (3, 'RESOLVED', 'Resuelta'),
    (4, 'REJECTED', 'Rechazada');

create table movement_type (id smallint primary key, code text not null unique, name text not null);
insert into movement_type (id, code, name) values
    (1, 'IN', 'Entrada'),
    (2, 'OUT', 'Salida');

create table reservation_status (id smallint primary key, code text not null unique, name text not null);
insert into reservation_status (id, code, name) values
    (1, 'ACTIVE', 'Activa'),
    (2, 'CONFIRMED', 'Confirmada'),
    (3, 'RELEASED', 'Liberada'),
    (4, 'EXPIRED', 'Vencida');

create table payment_result (id smallint primary key, code text not null unique, name text not null);
insert into payment_result (id, code, name) values
    (1, 'APPROVED', 'Aprobado'),
    (2, 'DECLINED', 'Rechazado'),
    (3, 'TIMEOUT', 'Sin respuesta a tiempo'),
    (4, 'ERROR', 'Error');

create table invoice_status (id smallint primary key, code text not null unique, name text not null);
insert into invoice_status (id, code, name) values
    (1, 'GENERATED', 'Generada'),
    (2, 'SENT', 'Enviada a la SAT'),
    (3, 'ACCEPTED', 'Aceptada por la SAT'),
    (4, 'REJECTED', 'Rechazada por la SAT');

create table carrier (id smallint primary key, code text not null unique, name text not null);
insert into carrier (id, code, name) values
    (1, 'LOGIEXPRESS', 'LogiExpress');

create table shipment_status (id smallint primary key, code text not null unique, name text not null);
insert into shipment_status (id, code, name) values
    (1, 'ASSIGNED', 'Asignado'),
    (2, 'GUIDE_REQUESTED', 'Guía solicitada'),
    (3, 'GUIDE_ISSUED', 'Guía emitida'),
    (4, 'IN_TRANSIT', 'En tránsito'),
    (5, 'DELIVERED', 'Entregado'),
    (6, 'FAILED', 'Fallido');

create table notification_channel (id smallint primary key, code text not null unique, name text not null);
insert into notification_channel (id, code, name) values
    (1, 'SMS', 'SMS'),
    (2, 'EMAIL', 'Correo'),
    (3, 'PUSH', 'Notificación push');

-- Estado de todo lo que se envía con reintentos: outbox, avisos, eventos del POS y lotes del ERP.
-- FAILED significa que se agotaron los reintentos.
create table delivery_status (id smallint primary key, code text not null unique, name text not null);
insert into delivery_status (id, code, name) values
    (1, 'PENDING', 'Pendiente'),
    (2, 'DELIVERED', 'Entregado'),
    (3, 'FAILED', 'Fallido');

create table file_format (id smallint primary key, code text not null unique, name text not null);
insert into file_format (id, code, name) values
    (1, 'CSV', 'CSV'),
    (2, 'XML', 'XML');

-- Configuración

create table setting (
    key         text primary key,
    value       text not null,
    description text,
    updated_at  timestamptz not null default now()
);

-- Catálogo y clientes

create table product (
    id          bigint generated always as identity primary key,
    sku         text not null unique,
    name        text not null,
    category_id smallint not null references product_category (id),
    price       numeric(12,2) not null check (price >= 0),
    active      boolean not null default true
);

create table customer (
    id         bigint generated always as identity primary key,
    full_name  text not null,
    email      text unique,
    phone      text,
    tax_id     text not null default 'CF',
    address    text,
    created_at timestamptz not null default now()
);

-- Inventario

create table location (
    id      bigint generated always as identity primary key,
    code    text not null unique,
    name    text not null,
    type_id smallint not null references location_type (id),
    unique (id, type_id)
);

-- on_hand y reserved son contadores: se guardan para poder reservar de forma atómica.
create table stock (
    location_id bigint not null references location (id),
    product_id  bigint not null references product (id),
    on_hand     integer not null default 0 check (on_hand >= 0),
    reserved    integer not null default 0 check (reserved >= 0),
    updated_at  timestamptz not null default now(),
    primary key (location_id, product_id),
    -- Aunque falle la app, la base no deja reservar más de lo que hay.
    constraint no_oversell check (reserved <= on_hand)
);

create index on stock (product_id);

-- Órdenes y carrito

create table cart (
    id              bigint generated always as identity primary key,
    customer_id     bigint not null references customer (id),
    last_channel_id smallint not null references channel (id),
    status_id       smallint not null default 1 references cart_status (id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Un cliente tiene un solo carrito activo, sin importar el canal desde el que compre.
-- Estados activos: 1 = OPEN, 2 = IN_CHECKOUT.
create unique index one_active_cart_per_customer on cart (customer_id) where status_id in (1, 2);

-- El carrito no guarda precio: se toma del catálogo y se fija al crear la orden.
create table cart_item (
    cart_id    bigint not null references cart (id) on delete cascade,
    product_id bigint not null references product (id),
    quantity   integer not null check (quantity > 0),
    primary key (cart_id, product_id)
);

-- total y delivery_address se guardan tal como se acordaron con el cliente al comprar.
create table purchase_order (
    id               bigint generated always as identity primary key,
    cart_id          bigint unique references cart (id),
    customer_id      bigint not null references customer (id),
    channel_id       smallint not null references channel (id),
    status_id        smallint not null default 1 references order_status (id),
    total            numeric(12,2) not null check (total >= 0),
    delivery_address text not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index on purchase_order (customer_id, created_at desc);
create index on purchase_order (status_id);

create table order_item (
    order_id   bigint not null references purchase_order (id),
    product_id bigint not null references product (id),
    quantity   integer not null check (quantity > 0),
    unit_price numeric(12,2) not null check (unit_price >= 0),
    primary key (order_id, product_id)
);

create table incident (
    id          bigint generated always as identity primary key,
    order_id    bigint not null references purchase_order (id),
    type_id     smallint not null references incident_type (id),
    status_id   smallint not null default 1 references incident_status (id),
    description text not null,
    created_at  timestamptz not null default now(),
    resolved_at timestamptz
);

create index on incident (order_id);

-- Movimientos y reservas de stock. La reserva se crea al iniciar el checkout.

create table stock_movement (
    id          bigint generated always as identity primary key,
    location_id bigint not null references location (id),
    product_id  bigint not null references product (id),
    type_id     smallint not null references movement_type (id),
    quantity    integer not null check (quantity > 0),
    reason      text,
    order_id    bigint references purchase_order (id),
    created_at  timestamptz not null default now()
);

create index on stock_movement (product_id, location_id, created_at desc);
create index on stock_movement (order_id) where order_id is not null;

create table reservation (
    id          bigint generated always as identity primary key,
    order_id    bigint not null,
    location_id bigint not null,
    product_id  bigint not null,
    quantity    integer not null check (quantity > 0),
    status_id   smallint not null default 1 references reservation_status (id),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null,
    closed_at   timestamptz,
    -- Solo se puede reservar un producto que la orden realmente lleva.
    foreign key (order_id, product_id) references order_item (order_id, product_id),
    foreign key (location_id, product_id) references stock (location_id, product_id),
    check (expires_at > created_at)
);

-- Para el job que libera reservas vencidas: 1 = ACTIVE.
create index reservation_to_expire on reservation (expires_at) where status_id = 1;
create index on reservation (order_id);

-- Pagos. No hay columnas para el número de tarjeta ni el CVV: solo la referencia de PayKlik y los últimos 4 dígitos.

create table payment_attempt (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references purchase_order (id),
    attempt_number     integer not null default 1 check (attempt_number > 0),
    result_id          smallint not null references payment_result (id),
    amount             numeric(12,2) not null check (amount >= 0),
    provider_reference text,
    card_last4         char(4) check (card_last4 ~ '^[0-9]{4}$'),
    failure_reason     text,
    latency_ms         integer check (latency_ms >= 0),
    attempted_at       timestamptz not null default now(),
    unique (order_id, attempt_number)
);

create index on payment_attempt (attempted_at desc);

-- Facturación

create table invoice (
    id           bigint generated always as identity primary key,
    order_id     bigint not null unique references purchase_order (id),
    status_id    smallint not null default 1 references invoice_status (id),
    cui          text not null,
    series       text not null,
    xml          text not null,
    sat_response text,
    generated_at timestamptz not null default now(),
    answered_at  timestamptz
);

-- Logística

create table shipment (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references purchase_order (id),
    origin_location_id bigint not null references location (id),
    carrier_id         smallint not null default 1 references carrier (id),
    status_id          smallint not null default 1 references shipment_status (id),
    tracking_number    text unique,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on shipment (order_id);

create table tracking_event (
    id          bigint generated always as identity primary key,
    shipment_id bigint not null references shipment (id),
    status_id   smallint not null references shipment_status (id),
    detail      text,
    occurred_at timestamptz not null default now()
);

create index on tracking_event (shipment_id, occurred_at desc);

-- Notificaciones

create table notification (
    id         bigint generated always as identity primary key,
    order_id   bigint not null references purchase_order (id),
    channel_id smallint not null references notification_channel (id),
    status_id  smallint not null default 1 references delivery_status (id),
    recipient  text not null,
    message    text not null,
    attempts   integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at    timestamptz
);

create index on notification (order_id);
create index on notification (created_at) where status_id = 1;

-- Integración: outbox, POS y lotes para el ERP.
-- event_type y aggregate_type son los nombres de los mensajes entre componentes, por eso quedan como texto.

create table outbox (
    id              bigint generated always as identity primary key,
    aggregate_type  text not null,
    aggregate_id    bigint not null,
    event_type      text not null,
    payload         jsonb not null,
    status_id       smallint not null default 1 references delivery_status (id),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    processed_at    timestamptz
);

-- Pendientes de enviar: 1 = PENDING.
create index outbox_pending on outbox (next_attempt_at) where status_id = 1;
create index on outbox (aggregate_type, aggregate_id);

create table pos_event (
    id              bigint generated always as identity primary key,
    store_id        bigint not null,
    -- Fijo en 2 = STORE. Junto con la llave foránea, el POS solo recibe eventos de una tienda, no de un centro.
    store_type_id   smallint not null default 2 check (store_type_id = 2),
    event_type      text not null,
    payload         jsonb not null,
    status_id       smallint not null default 1 references delivery_status (id),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    delivered_at    timestamptz,
    foreign key (store_id, store_type_id) references location (id, type_id)
);

create index pos_event_pending on pos_event (next_attempt_at) where status_id = 1;

-- En un lote, PENDING significa generado pero aún no enviado al ERP.
create table erp_batch (
    id           bigint generated always as identity primary key,
    window_start timestamptz not null,
    window_end   timestamptz not null,
    format_id    smallint not null references file_format (id),
    status_id    smallint not null default 1 references delivery_status (id),
    file_name    text not null,
    created_at   timestamptz not null default now(),
    sent_at      timestamptz,
    unique (window_start, window_end),
    check (window_end > window_start)
);

-- Una orden entra en un solo lote, así el ERP no recibe la misma venta dos veces.
create table erp_batch_order (
    order_id bigint primary key references purchase_order (id),
    batch_id bigint not null references erp_batch (id)
);

create index on erp_batch_order (batch_id);

-- Auditoría. Sin llave foránea a la orden a propósito: el registro no debe depender de otras tablas.
-- action y entity_type quedan como texto para que cualquier componente pueda registrar sin tocar el modelo.

create table audit_log (
    id          bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    actor       text not null,
    action      text not null,
    entity_type text not null,
    entity_id   text not null,
    order_id    bigint,
    channel_id  smallint references channel (id),
    details     jsonb not null default '{}'::jsonb
);

create index on audit_log (order_id, occurred_at desc) where order_id is not null;
create index on audit_log (entity_type, entity_id, occurred_at desc);
create index on audit_log (occurred_at desc);

-- La auditoría y los intentos de cobro solo se insertan, nunca se cambian ni se borran.

create function forbid_changes() returns trigger
language plpgsql as $$
begin
    raise exception '% sobre % no está permitido: el registro es de solo inserción', tg_op, tg_table_name;
end;
$$;

create trigger audit_log_no_update_delete
    before update or delete on audit_log
    for each row execute function forbid_changes();

create trigger audit_log_no_truncate
    before truncate on audit_log
    for each statement execute function forbid_changes();

create trigger payment_attempt_no_update_delete
    before update or delete on payment_attempt
    for each row execute function forbid_changes();

create trigger payment_attempt_no_truncate
    before truncate on payment_attempt
    for each statement execute function forbid_changes();

-- Vistas de lectura, con los códigos en lugar de los ids

-- Lo que consulta Finanzas: cada intento de cobro con el canal de su orden.
create view payment_audit as
select a.attempted_at, a.order_id, ch.code as channel, a.attempt_number, r.code as result, a.amount,
       a.provider_reference, a.card_last4, a.failure_reason, a.latency_ms
from payment_attempt a
join purchase_order o on o.id = a.order_id
join channel ch on ch.id = o.channel_id
join payment_result r on r.id = a.result_id;

-- Cantidad de órdenes y monto de cada lote, calculados a partir de sus órdenes.
create view erp_batch_summary as
select b.id, b.window_start, b.window_end, f.code as format, b.file_name, s.code as status,
       b.created_at, b.sent_at,
       count(e.order_id) as order_count,
       coalesce(sum(o.total), 0) as total_amount
from erp_batch b
join file_format f on f.id = b.format_id
join delivery_status s on s.id = b.status_id
left join erp_batch_order e on e.batch_id = b.id
left join purchase_order o on o.id = e.order_id
group by b.id, f.code, s.code;

-- Estado completo de una orden en una sola fila: cobro, factura y despacho. Es la consulta de los 5 segundos.
create view order_overview as
select o.id as order_id, o.created_at, o.customer_id, c.full_name as customer,
       ch.code as channel, os.code as status, o.total,
       pay.result as last_payment_result, pay.attempts as payment_attempts,
       inv.status as invoice_status,
       sh.status as shipment_status, sh.tracking_number
from purchase_order o
join customer c on c.id = o.customer_id
join channel ch on ch.id = o.channel_id
join order_status os on os.id = o.status_id
left join lateral (
    select r.code as result, count(*) over () as attempts
    from payment_attempt a
    join payment_result r on r.id = a.result_id
    where a.order_id = o.id
    order by a.attempt_number desc
    limit 1
) pay on true
left join lateral (
    select s.code as status
    from invoice i
    join invoice_status s on s.id = i.status_id
    where i.order_id = o.id
) inv on true
left join lateral (
    select s.code as status, x.tracking_number
    from shipment x
    join shipment_status s on s.id = x.status_id
    where x.order_id = o.id
    order by x.id desc
    limit 1
) sh on true;
