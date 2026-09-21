-- Base de datos de SGO-Logic. Una sola base con un esquema por componente (ADR-0001).
-- Los montos van en una sola moneda durante el MVP.

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

-- Configuración

create table config.setting (
    key         text primary key,
    value       text not null,
    description text,
    updated_at  timestamptz not null default now()
);

-- Valores de referencia que comparten varias tablas

create table config.channel (
    code text primary key
);

insert into config.channel (code) values ('WEB'), ('MOBILE'), ('CALL_CENTER');

-- Catálogo y clientes

create table catalog.category (
    code text primary key
);

insert into catalog.category (code) values ('LineaBlanca'), ('Electronica'), ('Ropa'), ('Calzado');

create table catalog.product (
    id       bigint generated always as identity primary key,
    sku      text not null unique,
    name     text not null,
    category text not null references catalog.category (code),
    price    numeric(12,2) not null check (price >= 0),
    active   boolean not null default true
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

create table inventory.location (
    id   bigint generated always as identity primary key,
    code text not null unique,
    name text not null,
    type text not null check (type in ('DISTRIBUTION_CENTER', 'STORE')),
    unique (id, type)
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

-- Órdenes y carrito

create table orders.cart (
    id           bigint generated always as identity primary key,
    customer_id  bigint not null references customers.customer (id),
    last_channel text not null references config.channel (code),
    status       text not null default 'OPEN' check (status in ('OPEN', 'IN_CHECKOUT', 'CONVERTED', 'ABANDONED')),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Un cliente tiene un solo carrito activo, sin importar el canal desde el que compre.
create unique index one_active_cart_per_customer
    on orders.cart (customer_id) where status in ('OPEN', 'IN_CHECKOUT');

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
    channel          text not null references config.channel (code),
    status           text not null default 'PENDING_PAYMENT' check (status in (
                         'PENDING_PAYMENT', 'PAYMENT_IN_PROGRESS', 'PAYMENT_FAILED', 'PAID',
                         'INVOICED', 'IN_DISPATCH', 'DELIVERED', 'CANCELLED', 'RETURNED')),
    total            numeric(12,2) not null check (total >= 0),
    delivery_address text not null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index on orders.purchase_order (customer_id, created_at desc);
create index on orders.purchase_order (status);

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
    kind        text not null check (kind in ('EXCHANGE', 'RETURN')),
    description text not null,
    status      text not null default 'REGISTERED' check (status in ('REGISTERED', 'IN_PROCESS', 'RESOLVED', 'REJECTED')),
    created_at  timestamptz not null default now(),
    resolved_at timestamptz
);

create index on orders.incident (order_id);

-- Movimientos y reservas de stock. La reserva se crea al iniciar el checkout.

create table inventory.stock_movement (
    id          bigint generated always as identity primary key,
    location_id bigint not null references inventory.location (id),
    product_id  bigint not null references catalog.product (id),
    kind        text not null check (kind in ('IN', 'OUT')),
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
    status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED')),
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null,
    closed_at   timestamptz,
    -- Solo se puede reservar un producto que la orden realmente lleva.
    foreign key (order_id, product_id) references orders.order_item (order_id, product_id),
    foreign key (location_id, product_id) references inventory.stock (location_id, product_id),
    check (expires_at > created_at)
);

create index reservation_to_expire on inventory.reservation (expires_at) where status = 'ACTIVE';
create index on inventory.reservation (order_id);

-- Pagos. No hay columnas para el número de tarjeta ni el CVV: solo la referencia de PayKlik y los últimos 4 dígitos.

create table payments.payment_attempt (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references orders.purchase_order (id),
    attempt_number     integer not null default 1 check (attempt_number > 0),
    result             text not null check (result in ('APPROVED', 'DECLINED', 'TIMEOUT', 'ERROR')),
    amount             numeric(12,2) not null check (amount >= 0),
    provider_reference text,
    card_last4         char(4) check (card_last4 ~ '^[0-9]{4}$'),
    failure_reason     text,
    latency_ms         integer check (latency_ms >= 0),
    attempted_at       timestamptz not null default now(),
    unique (order_id, attempt_number)
);

create index on payments.payment_attempt (attempted_at desc);

-- Lo que consulta Finanzas: cada intento con el canal de su orden.
create view payments.payment_audit as
select a.attempted_at, a.order_id, o.channel, a.attempt_number, a.result, a.amount,
       a.provider_reference, a.card_last4, a.failure_reason, a.latency_ms
from payments.payment_attempt a
join orders.purchase_order o on o.id = a.order_id;

-- Facturación

create table invoicing.invoice (
    id           bigint generated always as identity primary key,
    order_id     bigint not null unique references orders.purchase_order (id),
    cui          text not null,
    series       text not null,
    xml          text not null,
    status       text not null default 'GENERATED' check (status in ('GENERATED', 'SENT', 'ACCEPTED', 'REJECTED')),
    sat_response text,
    generated_at timestamptz not null default now(),
    answered_at  timestamptz
);

-- Logística

create table logistics.shipment (
    id                 bigint generated always as identity primary key,
    order_id           bigint not null references orders.purchase_order (id),
    origin_location_id bigint not null references inventory.location (id),
    carrier            text not null default 'LogiExpress',
    tracking_number    text unique,
    status             text not null default 'ASSIGNED' check (status in (
                           'ASSIGNED', 'GUIDE_REQUESTED', 'GUIDE_ISSUED', 'IN_TRANSIT', 'DELIVERED', 'FAILED')),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index on logistics.shipment (order_id);

create table logistics.tracking_event (
    id          bigint generated always as identity primary key,
    shipment_id bigint not null references logistics.shipment (id),
    status      text not null,
    detail      text,
    occurred_at timestamptz not null default now()
);

create index on logistics.tracking_event (shipment_id, occurred_at desc);

-- Notificaciones

create table notifications.notification (
    id         bigint generated always as identity primary key,
    order_id   bigint not null references orders.purchase_order (id),
    channel    text not null check (channel in ('SMS', 'EMAIL', 'PUSH')),
    recipient  text not null,
    message    text not null,
    status     text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
    attempts   integer not null default 0,
    last_error text,
    created_at timestamptz not null default now(),
    sent_at    timestamptz
);

create index on notifications.notification (order_id);
create index on notifications.notification (created_at) where status = 'PENDING';

-- Integración: outbox, POS y lotes para el ERP

create table integration.outbox (
    id              bigint generated always as identity primary key,
    aggregate_type  text not null,
    aggregate_id    bigint not null,
    event_type      text not null,
    payload         jsonb not null,
    status          text not null default 'PENDING' check (status in ('PENDING', 'PROCESSED', 'DEAD')),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    processed_at    timestamptz
);

create index outbox_pending on integration.outbox (next_attempt_at) where status = 'PENDING';
create index on integration.outbox (aggregate_type, aggregate_id);

create table integration.pos_event (
    id              bigint generated always as identity primary key,
    store_id        bigint not null,
    -- Junto con la llave foránea, asegura que el POS solo reciba eventos de una tienda, no de un centro.
    store_type      text not null default 'STORE' check (store_type = 'STORE'),
    event_type      text not null,
    payload         jsonb not null,
    status          text not null default 'PENDING' check (status in ('PENDING', 'DELIVERED', 'DEAD')),
    attempts        integer not null default 0,
    next_attempt_at timestamptz not null default now(),
    last_error      text,
    created_at      timestamptz not null default now(),
    delivered_at    timestamptz,
    foreign key (store_id, store_type) references inventory.location (id, type)
);

create index pos_event_pending on integration.pos_event (next_attempt_at) where status = 'PENDING';

create table integration.erp_batch (
    id           bigint generated always as identity primary key,
    window_start timestamptz not null,
    window_end   timestamptz not null,
    format       text not null check (format in ('CSV', 'XML')),
    file_name    text not null,
    status       text not null default 'GENERATED' check (status in ('GENERATED', 'SENT', 'FAILED')),
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

-- Cantidad de órdenes y monto de cada lote, calculados a partir de sus órdenes.
create view integration.erp_batch_summary as
select b.id, b.window_start, b.window_end, b.format, b.file_name, b.status, b.created_at, b.sent_at,
       count(e.order_id) as order_count,
       coalesce(sum(o.total), 0) as total_amount
from integration.erp_batch b
left join integration.erp_batch_order e on e.batch_id = b.id
left join orders.purchase_order o on o.id = e.order_id
group by b.id;

-- Auditoría. Sin llaves foráneas a propósito: el registro no debe depender de otras tablas.

create table audit.audit_log (
    id          bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    actor       text not null,
    action      text not null,
    entity_type text not null,
    entity_id   text not null,
    order_id    bigint,
    channel     text,
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
