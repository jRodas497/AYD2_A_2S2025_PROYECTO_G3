-- Antes, el cliente de la tienda era un registro anónimo auto-creado por el frontend
-- ("Cliente invitado") sin contraseña: cualquiera que tuviera el id podía operar como ese
-- cliente. Esta migración agrega la contraseña para que el cliente pueda iniciar sesión de
-- verdad (CustomerAuthController), y siembra varias cuentas de demo con historiales de compra
-- distintos entre sí, para poder entrar con usuarios distintos y ver carritos, compras,
-- facturas y crédito propios de cada uno en vez de todo colgado de un solo cliente genérico.

set search_path = config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications, integration, audit;

alter table customers.customer add column password_hash text;

-- Contraseña de las 5 cuentas de demo: "cliente123" (mismo hash bcrypt para las cinco, generado
-- aparte, igual que el admin de V7 — la base nunca ve la contraseña en texto plano).
insert into customers.customer (full_name, email, phone, tax_id, address, password_hash)
values
    ('María López',       'maria@example.com',  '50201110001', 'CF', 'Zona 10, Ciudad de Guatemala',
     '$2b$10$v0YaPQdx0cnV3xE20/sQLeBJ8A18tgsQwLnEBdq4Qbqje4lHBkjqG'),
    ('Carlos Pérez',      'carlos@example.com', '50201110002', 'CF', 'Zona 1, Ciudad de Guatemala',
     '$2b$10$v0YaPQdx0cnV3xE20/sQLeBJ8A18tgsQwLnEBdq4Qbqje4lHBkjqG'),
    ('Ana Gómez',         'ana@example.com',    '50201110003', 'CF', 'Zona 7, Ciudad de Guatemala',
     '$2b$10$v0YaPQdx0cnV3xE20/sQLeBJ8A18tgsQwLnEBdq4Qbqje4lHBkjqG'),
    ('Jorge Ramírez',     'jorge@example.com',  '50201110004', 'CF', 'Zona 15, Ciudad de Guatemala',
     '$2b$10$v0YaPQdx0cnV3xE20/sQLeBJ8A18tgsQwLnEBdq4Qbqje4lHBkjqG'),
    ('Lucía Fernández',   'lucia@example.com',  '50201110005', 'CF', 'Zona 4, Ciudad de Guatemala',
     '$2b$10$v0YaPQdx0cnV3xE20/sQLeBJ8A18tgsQwLnEBdq4Qbqje4lHBkjqG');

-- Órdenes completas (pagada, facturada y entregada), con distinta cantidad y mezcla de producto
-- por cliente a propósito: María y Lucía con varias compras de montos altos (candidatas claras
-- a crédito propio), Ana con compras pequeñas, Carlos y Jorge casi sin historial.
do $$
declare
    r record;
    v_customer_id bigint;
    v_cart_id     bigint;
    v_order_id    bigint;
    v_shipment_id bigint;
    v_unit_price  numeric(12,2);
    v_total       numeric(12,2);
    v_seq         integer := 0;
begin
    for r in
        select * from (values
            ('maria@example.com', 'LB-001', 1, 35),
            ('maria@example.com', 'EL-002', 1, 20),
            ('maria@example.com', 'EL-003', 2, 6),
            ('ana@example.com',   'RO-001', 3, 15),
            ('ana@example.com',   'CA-001', 1, 4),
            ('lucia@example.com', 'LB-002', 1, 40),
            ('lucia@example.com', 'LB-003', 1, 28),
            ('lucia@example.com', 'RO-002', 2, 12),
            ('lucia@example.com', 'CA-003', 2, 3)
        ) as t(email, sku, qty, days_ago)
    loop
        v_seq := v_seq + 1;

        select id into v_customer_id from customers.customer where email = r.email;
        select price into v_unit_price from catalog.product where sku = r.sku;
        v_total := v_unit_price * r.qty;

        insert into orders.cart (customer_id, last_channel_id, status_id, created_at, updated_at)
        values (v_customer_id, 1, 3, now() - (r.days_ago || ' days')::interval, now() - (r.days_ago || ' days')::interval)
        returning id into v_cart_id;

        insert into orders.purchase_order
            (cart_id, customer_id, channel_id, status_id, total, delivery_address, created_at, updated_at)
        select v_cart_id, v_customer_id, 1, 7, v_total, c.address,
               now() - (r.days_ago || ' days')::interval, now() - ((r.days_ago - 2) || ' days')::interval
        from customers.customer c where c.id = v_customer_id
        returning id into v_order_id;

        insert into orders.order_item (order_id, product_id, quantity, unit_price)
        select v_order_id, p.id, r.qty, v_unit_price from catalog.product p where p.sku = r.sku;

        insert into payments.payment_attempt
            (order_id, attempt_number, result_id, amount, provider_reference, card_last4, latency_ms, attempted_at)
        values (v_order_id, 1, 1, v_total, 'PK-DEMO-' || lpad(v_seq::text, 4, '0'), '4242', 80,
                now() - (r.days_ago || ' days')::interval);

        insert into invoicing.invoice (order_id, status_id, cui, series, xml, generated_at, answered_at)
        values (v_order_id, 3, 'DEMO-CUI-' || lpad(v_seq::text, 4, '0'), 'A',
                '<factura orden="' || v_order_id || '"/>',
                now() - ((r.days_ago - 1) || ' days')::interval, now() - ((r.days_ago - 1) || ' days')::interval);

        insert into logistics.shipment
            (order_id, origin_location_id, carrier_id, status_id, tracking_number, created_at, updated_at)
        select v_order_id, l.id, 1, 5, 'LX-DEMO-' || lpad(v_seq::text, 4, '0'),
               now() - ((r.days_ago - 1) || ' days')::interval, now() - ((r.days_ago - 2) || ' days')::interval
        from inventory.location l where l.code = 'CD-01'
        returning id into v_shipment_id;

        insert into logistics.tracking_event (shipment_id, status_id, detail, occurred_at)
        values (v_shipment_id, 5, 'Entregado al cliente', now() - ((r.days_ago - 2) || ' days')::interval);
    end loop;
end $$;

-- Carlos: una compra reciente que no llegó a pagarse (tarjeta rechazada), sin factura ni envío.
-- Jorge: cuenta nueva, sin ninguna compra todavía.
do $$
declare
    v_customer_id bigint;
    v_cart_id     bigint;
    v_order_id    bigint;
    v_unit_price  numeric(12,2);
begin
    select id into v_customer_id from customers.customer where email = 'carlos@example.com';
    select price into v_unit_price from catalog.product where sku = 'EL-001';

    insert into orders.cart (customer_id, last_channel_id, status_id, created_at, updated_at)
    values (v_customer_id, 1, 3, now() - interval '2 days', now() - interval '2 days')
    returning id into v_cart_id;

    insert into orders.purchase_order
        (cart_id, customer_id, channel_id, status_id, total, delivery_address, created_at, updated_at)
    select v_cart_id, v_customer_id, 1, 1, v_unit_price, c.address, now() - interval '2 days', now() - interval '2 days'
    from customers.customer c where c.id = v_customer_id
    returning id into v_order_id;

    insert into orders.order_item (order_id, product_id, quantity, unit_price)
    select v_order_id, p.id, 1, v_unit_price from catalog.product p where p.sku = 'EL-001';

    insert into payments.payment_attempt
        (order_id, attempt_number, result_id, amount, provider_reference, card_last4, failure_reason, latency_ms, attempted_at)
    values (v_order_id, 1, 2, v_unit_price, 'PK-DEMO-9001', '1881', 'fondos insuficientes', 60, now() - interval '2 days');
end $$;

-- A Ana se le devolvió una de sus compras (CDU de incidencias): la orden sigue entregada, la
-- devolución queda registrada y resuelta por separado.
insert into orders.incident (order_id, type_id, status_id, description, created_at, resolved_at)
select o.id, 2, 3, 'Producto llegó con un defecto de fábrica; se aceptó la devolución.',
       o.created_at + interval '3 days', o.created_at + interval '6 days'
from orders.purchase_order o
join customers.customer c on c.id = o.customer_id
join orders.order_item oi on oi.order_id = o.id
join catalog.product p on p.id = oi.product_id
where c.email = 'ana@example.com' and p.sku = 'CA-001';
