-- Base de datos de SGO-Logic (PostgreSQL 16). Una sola base con un esquema por componente (ADR-0001).
-- Los montos van en una sola moneda durante el MVP.
--
-- Todo dato con un conjunto fijo de valores (canal, estado, tipo) tiene su tabla de referencia
-- con id, code y name. Los ids son fijos y siguen el orden de los INSERT.
-- Cada tabla de referencia vive en el esquema del componente que la usa. Las que comparten
-- varios componentes (channel y delivery_status) están en config.

create schema config;
create schema catalog;
create schema customers;
create schema inventory;
create schema orders;
create schema payments;
create schema invoicing;
create schema logistics;
create schema notifications;
create schema integration;
create schema audit;

-- Configuración y valores compartidos

create table config.setting (
    key         text primary key,
    value       text not null,
    description text,
    updated_at  timestamptz not null default now()
);

create table config.channel (id smallint primary key, code text not null unique, name text not null);
insert into config.channel (id, code, name) values
    (1, 'WEB', 'Sitio web'),
    (2, 'MOBILE', 'Aplicación móvil'),
    (3, 'CALL_CENTER', 'Centro de atención telefónica');

-- Estado de todo lo que se envía con reintentos: outbox, avisos, eventos del POS y lotes del ERP.
-- FAILED significa que se agotaron los reintentos.
create table config.delivery_status (id smallint primary key, code text not null unique, name text not null);
insert into config.delivery_status (id, code, name) values
    (1, 'PENDING', 'Pendiente'),
    (2, 'DELIVERED', 'Entregado'),
    (3, 'FAILED', 'Fallido');

-- Catálogo y clientes

create table catalog.product_category (id smallint primary key, code text not null unique, name text not null);
insert into catalog.product_category (id, code, name) values
    (1, 'LINEA_BLANCA', 'Línea blanca'),
    (2, 'ELECTRONICA', 'Electrónica'),
    (3, 'ROPA', 'Ropa'),
    (4, 'CALZADO', 'Calzado');

create table catalog.product (
    id          bigint generated always as identity primary key,
    sku         text not null unique,
    name        text not null,
    category_id smallint not null references catalog.product_category (id),
    price       numeric(12,2) not null check (price >= 0),
    active      boolean not null default true
);

create table customers.customer (
    id         bigint generated always as identity primary key,
    full_name  text not null,
    email      text unique,
    phone      text,
    tax_id     text not null default 'CF',
    address    text,
    created_at timestamptz not null default now()
);

-- Inventario

create table inventory.location_type (id smallint primary key, code text not null unique, name text not null);
insert into inventory.location_type (id, code, name) values
    (1, 'DISTRIBUTION_CENTER', 'Centro de distribución'),
    (2, 'STORE', 'Tienda');

create table inventory.location (
    id      bigint generated always as identity primary key,
    code    text not null unique,
    name    text not null,
    type_id smallint not null references inventory.location_type (id),
    unique (id, type_id)
);

-- on_hand y reserved son contadores: se guardan para poder reservar de forma atómica.
create table inventory.stock (
    location_id bigint not null references inventory.location (id),
    product_id  bigint not null references catalog.product (id),
    on_hand     integer not null default 0 check (on_hand >= 0),
    reserved    integer not null default 0 check (reserved >= 0),
    updated_at  timestamptz not null default now(),
    primary key (location_id, product_id),
    -- Aunque falle la app, la base no deja reservar más de lo que hay.
    constraint no_oversell check (reserved <= on_hand)
);

create index on inventory.stock (product_id);

create table inventory.movement_type (id smallint primary key, code text not null unique, name text not null);
insert into inventory.movement_type (id, code, name) values
    (1, 'IN', 'Entrada'),
    (2, 'OUT', 'Salida');

create table inventory.reservation_status (id smallint primary key, code text not null unique, name text not null);
insert into inventory.reservation_status (id, code, name) values
    (1, 'ACTIVE', 'Activa'),
    (2, 'CONFIRMED', 'Confirmada'),
    (3, 'RELEASED', 'Liberada'),
    (4, 'EXPIRED', 'Vencida');

-- Órdenes y carrito

create table orders.cart_status (id smallint primary key, code text not null unique, name text not null);
insert into orders.cart_status (id, code, name) values
    (1, 'OPEN', 'Abierto'),
    (2, 'IN_CHECKOUT', 'En checkout'),
    (3, 'CONVERTED', 'Convertido en orden'),
    (4, 'ABANDONED', 'Abandonado');

create table orders.order_status (id smallint primary key, code text not null unique, name text not null);
insert into orders.order_status (id, code, name) values
    (1, 'PENDING_PAYMENT', 'Pendiente de pago'),
    (2, 'PAYMENT_IN_PROGRESS', 'Pago en proceso'),
    (3, 'PAYMENT_FAILED', 'Pago fallido'),
    (4, 'PAID', 'Pagada'),
    (5, 'INVOICED', 'Facturada'),
    (6, 'IN_DISPATCH', 'En despacho'),
    (7, 'DELIVERED', 'Entregada'),
    (8, 'CANCELLED', 'Cancelada'),
    (9, 'RETURNED', 'Devuelta');

create table orders.incident_type (id smallint primary key, code text not null unique, name text not null);
insert into orders.incident_type (id, code, name) values
    (1, 'EXCHANGE', 'Cambio'),
    (2, 'RETURN', 'Devolución');

create table orders.incident_status (id smallint primary key, code text not null unique, name text not null);
insert into orders.incident_status (id, code, name) values
    (1, 'REGISTERED', 'Registrada'),
    (2, 'IN_PROCESS', 'En proceso'),
    (3, 'RESOLVED', 'Resuelta'),
    (4, 'REJECTED', 'Rechazada');

create table orders.cart (
    id              bigint generated always as identity primary key,
    customer_id     bigint not null references customers.customer (id),
    last_channel_id smallint not null references config.channel (id),
    status_id       smallint not null default 1 references orders.cart_status (id),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- Un cliente tiene un solo carrito activo, sin importar el canal desde el que compre.
-- Estados activos: 1 = OPEN, 2 = IN_CHECKOUT.
create unique index one_active_cart_per_customer on orders.cart (customer_id) where status_id in (1, 2);

-- El carrito no guarda precio: se toma del catálogo y se fija al crear la orden.
create table orders.cart_item (
    cart_id    bigint not null references orders.cart (id) on delete cascade,
    product_id bigint not null references catalog.product (id),
    quantity   integer not null check (quantity > 0),
    primary key (cart_id, product_id)
);

-- total y delivery_address se guardan tal como se acordaron con el cliente al comprar.
create table orders.purchase_order (
    id               bigint generated always as identity primary key,
    cart_id          bigint unique references orders.cart (id),
    customer_id      bigint not null references customers.customer (id),
    channel_id       smallint not null references config.channel (id),
    status_id        smallint not null default 1 references orders.order_status (id),
    total            numeric(12,2) not null check (total >= 0),
    delivery_address text not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index on orders.purchase_order (customer_id, created_at desc);
create index on orders.purchase_order (status_id);

create table orders.order_item (
    order_id   bigint not null references orders.purchase_order (id),
    product_id bigint not null references catalog.product (id),
    quantity   integer not null check (quantity > 0),
    unit_price numeric(12,2) not null check (unit_price >= 0),
    primary key (order_id, product_id)
);

create table orders.incident (
    id          bigint generated always as identity primary key,
    order_id    bigint not null references orders.purchase_order (id),
    type_id     smallint not null references orders.incident_type (id),
    status_id   smallint not null default 1 references orders.incident_status (id),
    description text not null,
    created_at  timestamptz not null default now(),
    resolved_at timestamptz
);

create index on orders.incident (order_id);

-- Movimientos y reservas de stock. La reserva se crea al iniciar el checkout.

create table inventory.stock_movement (
    id          bigint generated always as identity primary key,
    location_id bigint not null references inventory.location (id),
    product_id  bigint not null references catalog.product (id),
    type_id     smallint not null references inventory.movement_type (id),
    quantity    integer not null check (quantity > 0),
    reason      text,
    order_id    bigint references orders.purchase_order (id),
    created_at  timestamptz not null default now()
);

create index on inventory.stock_movement (product_id, location_id, created_at desc);
create index on inventory.stock_movement (order_id) where order_id is not null;

create table inventory.reservation (
    id          bigint generated always as identity primary key,
    order_id    bigint not null,
    location_id bigint not null,
    product_id  bigint not null,
    quantity    integer not null check (quantity > 0),
    status_id   smallint not null default 1 references inventory.reservation_status (id),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null,
    closed_at   timestamptz,
    -- Solo se puede reservar un producto que la orden realmente lleva.
    foreign key (order_id, product_id) references orders.order_item (order_id, product_id),
    foreign key (location_id, product_id) references inventory.stock (location_id, product_id),
    check (expires_at > created_at)
);

-- Para el job que libera reservas vencidas: 1 = ACTIVE.
create index reservation_to_expire on inventory.reservation (expires_at) where status_id = 1;
create index on inventory.reservation (order_id);

-- Pagos. No hay columnas para el número de tarjeta ni el CVV: solo la referencia de PayKlik y los últimos 4 dígitos.

create table payments.payment_result (id smallint primary key, code text not null unique, name text not null);
insert into payments.payment_result (id, code, name) values
    (1, 'APPROVED', 'Aprobado'),
    (2, 'DECLINED', 'Rechazado'),
    (3, 'TIMEOUT', 'Sin respuesta a tiempo'),
    (4, 'ERROR', 'Error');

create table payments.payment_attempt (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references orders.purchase_order (id),
    attempt_number     integer not null default 1 check (attempt_number > 0),
    result_id          smallint not null references payments.payment_result (id),
    amount             numeric(12,2) not null check (amount >= 0),
    provider_reference text,
    card_last4         char(4) check (card_last4 ~ '^[0-9]{4}$'),
    failure_reason     text,
    latency_ms         integer check (latency_ms >= 0),
    attempted_at       timestamptz not null default now(),
    unique (order_id, attempt_number)
);

create index on payments.payment_attempt (attempted_at desc);

-- Facturación

create table invoicing.invoice_status (id smallint primary key, code text not null unique, name text not null);
insert into invoicing.invoice_status (id, code, name) values
    (1, 'GENERATED', 'Generada'),
    (2, 'SENT', 'Enviada a la SAT'),
    (3, 'ACCEPTED', 'Aceptada por la SAT'),
    (4, 'REJECTED', 'Rechazada por la SAT');

create table invoicing.invoice (
    id           bigint generated always as identity primary key,
    order_id     bigint not null unique references orders.purchase_order (id),
    status_id    smallint not null default 1 references invoicing.invoice_status (id),
    cui          text not null,
    series       text not null,
    xml          text not null,
    sat_response text,
    generated_at timestamptz not null default now(),
    answered_at  timestamptz
);

-- Logística

create table logistics.carrier (id smallint primary key, code text not null unique, name text not null);
insert into logistics.carrier (id, code, name) values
    (1, 'LOGIEXPRESS', 'LogiExpress');

create table logistics.shipment_status (id smallint primary key, code text not null unique, name text not null);
insert into logistics.shipment_status (id, code, name) values
    (1, 'ASSIGNED', 'Asignado'),
    (2, 'GUIDE_REQUESTED', 'Guía solicitada'),
    (3, 'GUIDE_ISSUED', 'Guía emitida'),
    (4, 'IN_TRANSIT', 'En tránsito'),
    (5, 'DELIVERED', 'Entregado'),
    (6, 'FAILED', 'Fallido');

create table logistics.shipment (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references orders.purchase_order (id),
    origin_location_id bigint not null references inventory.location (id),
    carrier_id         smallint not null default 1 references logistics.carrier (id),
    status_id          smallint not null default 1 references logistics.shipment_status (id),
    tracking_number    text unique,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on logistics.shipment (order_id);

create table logistics.tracking_event (
    id          bigint generated always as identity primary key,
    shipment_id bigint not null references logistics.shipment (id),
    status_id   smallint not null references logistics.shipment_status (id),
    detail      text,
    occurred_at timestamptz not null default now()
);

create index on logistics.tracking_event (shipment_id, occurred_at desc);

-- Notificaciones

create table notifications.notification_channel (id smallint primary key, code text not null unique, name text not null);
insert into notifications.notification_channel (id, code, name) values
    (1, 'SMS', 'SMS'),
    (2, 'EMAIL', 'Correo'),
    (3, 'PUSH', 'Notificación push');

create table notifications.notification (
    id         bigint generated always as identity primary key,
    order_id   bigint not null references orders.purchase_order (id),
    channel_id smallint not null references notifications.notification_channel (id),
    status_id  smallint not null default 1 references config.delivery_status (id),
    recipient  text not null,
    message    text not null,
    attempts   integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at    timestamptz
);

create index on notifications.notification (order_id);
create index on notifications.notification (created_at) where status_id = 1;

-- Integración: outbox, POS y lotes para el ERP.
-- event_type y aggregate_type son los nombres de los mensajes entre componentes, por eso quedan como texto.

create table integration.file_format (id smallint primary key, code text not null unique, name text not null);
insert into integration.file_format (id, code, name) values
    (1, 'CSV', 'CSV'),
    (2, 'XML', 'XML');

create table integration.outbox (
    id              bigint generated always as identity primary key,
    aggregate_type  text not null,
    aggregate_id    bigint not null,
    event_type      text not null,
    payload         jsonb not null,
    status_id       smallint not null default 1 references config.delivery_status (id),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    processed_at    timestamptz
);

-- Pendientes de enviar: 1 = PENDING.
create index outbox_pending on integration.outbox (next_attempt_at) where status_id = 1;
create index on integration.outbox (aggregate_type, aggregate_id);

create table integration.pos_event (
    id              bigint generated always as identity primary key,
    store_id        bigint not null,
    -- Fijo en 2 = STORE. Junto con la llave foránea, el POS solo recibe eventos de una tienda, no de un centro.
    store_type_id   smallint not null default 2 check (store_type_id = 2),
    event_type      text not null,
    payload         jsonb not null,
    status_id       smallint not null default 1 references config.delivery_status (id),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    delivered_at    timestamptz,
    foreign key (store_id, store_type_id) references inventory.location (id, type_id)
);

create index pos_event_pending on integration.pos_event (next_attempt_at) where status_id = 1;

-- En un lote, PENDING significa generado pero aún no enviado al ERP.
create table integration.erp_batch (
    id           bigint generated always as identity primary key,
    window_start timestamptz not null,
    window_end   timestamptz not null,
    format_id    smallint not null references integration.file_format (id),
    status_id    smallint not null default 1 references config.delivery_status (id),
    file_name    text not null,
    created_at   timestamptz not null default now(),
    sent_at      timestamptz,
    unique (window_start, window_end),
    check (window_end > window_start)
);

-- Una orden entra en un solo lote, así el ERP no recibe la misma venta dos veces.
create table integration.erp_batch_order (
    order_id bigint primary key references orders.purchase_order (id),
    batch_id bigint not null references integration.erp_batch (id)
);

create index on integration.erp_batch_order (batch_id);

-- Auditoría. Sin llave foránea a la orden a propósito: el registro no debe depender de otras tablas.
-- action y entity_type quedan como texto para que cualquier componente pueda registrar sin tocar el modelo.

create table audit.audit_log (
    id          bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    actor       text not null,
    action      text not null,
    entity_type text not null,
    entity_id   text not null,
    order_id    bigint,
    channel_id  smallint references config.channel (id),
    details     jsonb not null default '{}'::jsonb
);

create index on audit.audit_log (order_id, occurred_at desc) where order_id is not null;
create index on audit.audit_log (entity_type, entity_id, occurred_at desc);
create index on audit.audit_log (occurred_at desc);

-- La auditoría y los intentos de cobro solo se insertan, nunca se cambian ni se borran.

create function audit.forbid_changes() returns trigger
language plpgsql as $$
begin
    raise exception '% sobre %.% no está permitido: el registro es de solo inserción',
        tg_op, tg_table_schema, tg_table_name;
end;
$$;

create trigger audit_log_no_update_delete
    before update or delete on audit.audit_log
    for each row execute function audit.forbid_changes();

create trigger audit_log_no_truncate
    before truncate on audit.audit_log
    for each statement execute function audit.forbid_changes();

create trigger payment_attempt_no_update_delete
    before update or delete on payments.payment_attempt
    for each row execute function audit.forbid_changes();

create trigger payment_attempt_no_truncate
    before truncate on payments.payment_attempt
    for each statement execute function audit.forbid_changes();

-- Vistas de lectura, con los códigos en lugar de los ids

-- Lo que consulta Finanzas: cada intento de cobro con el canal de su orden.
create view payments.payment_audit as
select a.attempted_at, a.order_id, ch.code as channel, a.attempt_number, r.code as result, a.amount,
       a.provider_reference, a.card_last4, a.failure_reason, a.latency_ms
from payments.payment_attempt a
join orders.purchase_order o on o.id = a.order_id
join config.channel ch on ch.id = o.channel_id
join payments.payment_result r on r.id = a.result_id;

-- Cantidad de órdenes y monto de cada lote, calculados a partir de sus órdenes.
create view integration.erp_batch_summary as
select b.id, b.window_start, b.window_end, f.code as format, b.file_name, s.code as status,
       b.created_at, b.sent_at,
       count(e.order_id) as order_count,
       coalesce(sum(o.total), 0) as total_amount
from integration.erp_batch b
join integration.file_format f on f.id = b.format_id
join config.delivery_status s on s.id = b.status_id
left join integration.erp_batch_order e on e.batch_id = b.id
left join orders.purchase_order o on o.id = e.order_id
group by b.id, f.code, s.code;

-- Estado completo de una orden en una sola fila: cobro, factura y despacho. Es la consulta de los 5 segundos.
create view orders.order_overview as
select o.id as order_id, o.created_at, o.customer_id, c.full_name as customer,
       ch.code as channel, os.code as status, o.total,
       pay.result as last_payment_result, pay.attempts as payment_attempts,
       inv.status as invoice_status,
       sh.status as shipment_status, sh.tracking_number
from orders.purchase_order o
join customers.customer c on c.id = o.customer_id
join config.channel ch on ch.id = o.channel_id
join orders.order_status os on os.id = o.status_id
left join lateral (
    select r.code as result, count(*) over () as attempts
    from payments.payment_attempt a
    join payments.payment_result r on r.id = a.result_id
    where a.order_id = o.id
    order by a.attempt_number desc
    limit 1
) pay on true
left join lateral (
    select s.code as status
    from invoicing.invoice i
    join invoicing.invoice_status s on s.id = i.status_id
    where i.order_id = o.id
) inv on true
left join lateral (
    select s.code as status, x.tracking_number
    from logistics.shipment x
    join logistics.shipment_status s on s.id = x.status_id
    where x.order_id = o.id
    order by x.id desc
    limit 1
) sh on true;

-- Para que las consultas y el ORM funcionen sin escribir el esquema delante de cada tabla.
-- Los nombres de tabla son únicos en toda la base, así que no hay ambigüedad.
do $$
begin
    execute format(
        'alter database %I set search_path = config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications, integration, audit, public',
        current_database());
end $$;
