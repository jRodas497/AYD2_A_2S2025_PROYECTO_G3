-- Datos de ejemplo para desarrollo y para la demo. No son datos reales.

set search_path = config, catalog, customers, inventory, orders, payments, invoicing, logistics, notifications, integration, audit;

insert into setting (key, value, description) values
    ('reservation.ttl_minutes', '15', 'Minutos que dura una reserva de stock si la compra no se concreta'),
    ('erp.batch_interval_minutes', '30', 'Cada cuántos minutos se genera el archivo para el ERP AS/400'),
    ('payment.timeout_ms', '5000', 'Latencia de PayKlik a partir de la cual el cobro pasa a la cola de contingencia');

-- 2 centros de distribución y 32 tiendas
insert into location (code, name, type_id)
select v.code, v.name, t.id
from (values ('CD-01', 'Centro de distribución 1', 'DISTRIBUTION_CENTER'),
             ('CD-02', 'Centro de distribución 2', 'DISTRIBUTION_CENTER')) as v (code, name, type)
join location_type t on t.code = v.type;

insert into location (code, name, type_id)
select 'T-' || lpad(n::text, 2, '0'), 'Tienda ' || lpad(n::text, 2, '0'), t.id
from generate_series(1, 32) as n
cross join (select id from location_type where code = 'STORE') t;

insert into product (sku, name, category_id, price)
select v.sku, v.name, c.id, v.price
from (values ('LB-001', 'Refrigeradora 300 L', 'LINEA_BLANCA', 4200.00),
             ('LB-002', 'Lavadora 18 kg', 'LINEA_BLANCA', 3500.00),
             ('LB-003', 'Estufa de 4 quemadores', 'LINEA_BLANCA', 2100.00),
             ('EL-001', 'Televisor 55 pulgadas', 'ELECTRONICA', 3900.00),
             ('EL-002', 'Laptop 14 pulgadas', 'ELECTRONICA', 5600.00),
             ('EL-003', 'Audífonos inalámbricos', 'ELECTRONICA', 450.00),
             ('RO-001', 'Camisa manga larga', 'ROPA', 180.00),
             ('RO-002', 'Pantalón de mezclilla', 'ROPA', 260.00),
             ('RO-003', 'Chumpa impermeable', 'ROPA', 390.00),
             ('CA-001', 'Zapatos deportivos', 'CALZADO', 520.00),
             ('CA-002', 'Zapatos de vestir', 'CALZADO', 480.00),
             ('CA-003', 'Sandalias', 'CALZADO', 150.00)) as v (sku, name, category, price)
join product_category c on c.code = v.category;

-- Cada centro arranca con 200 unidades por producto y cada tienda entre 10 y 24
insert into stock (location_id, product_id, on_hand)
select l.id, p.id,
       case when t.code = 'DISTRIBUTION_CENTER' then 200 else 10 + (l.id * p.id) % 15 end
from location l
join location_type t on t.id = l.type_id
cross join product p;

insert into stock_movement (location_id, product_id, type_id, quantity, reason)
select s.location_id, s.product_id, m.id, s.on_hand, 'Carga inicial'
from stock s
cross join (select id from movement_type where code = 'IN') m;

-- 100 clientes para poder probar muchas órdenes de personas distintas
insert into customer (full_name, email, phone, address)
select 'Cliente de prueba ' || n,
       'cliente' || n || '@example.com',
       '5020' || lpad(n::text, 7, '0'),
       'Zona ' || (1 + n % 21) || ', Ciudad de Guatemala'
from generate_series(1, 100) as n;
