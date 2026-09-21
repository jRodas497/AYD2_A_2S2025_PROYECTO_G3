-- Datos de ejemplo para desarrollo y para la demo. No son datos reales.

insert into config.setting (key, value, description) values
    ('reservation.ttl_minutes', '15', 'Minutos que dura una reserva de stock si la compra no se concreta'),
    ('erp.batch_interval_minutes', '30', 'Cada cuántos minutos se genera el archivo para el ERP AS/400'),
    ('payment.timeout_ms', '5000', 'Latencia de PayKlik a partir de la cual el cobro pasa a la cola de contingencia');

-- 2 centros de distribución y 32 tiendas
insert into inventory.location (code, name, type) values
    ('CD-01', 'Centro de distribución 1', 'DISTRIBUTION_CENTER'),
    ('CD-02', 'Centro de distribución 2', 'DISTRIBUTION_CENTER');

insert into inventory.location (code, name, type)
select 'T-' || lpad(n::text, 2, '0'), 'Tienda ' || lpad(n::text, 2, '0'), 'STORE'
from generate_series(1, 32) as n;

insert into catalog.product (sku, name, category, price) values
    ('LB-001', 'Refrigeradora 300 L', 'LineaBlanca', 4200.00),
    ('LB-002', 'Lavadora 18 kg', 'LineaBlanca', 3500.00),
    ('LB-003', 'Estufa de 4 quemadores', 'LineaBlanca', 2100.00),
    ('EL-001', 'Televisor 55 pulgadas', 'Electronica', 3900.00),
    ('EL-002', 'Laptop 14 pulgadas', 'Electronica', 5600.00),
    ('EL-003', 'Audífonos inalámbricos', 'Electronica', 450.00),
    ('RO-001', 'Camisa manga larga', 'Ropa', 180.00),
    ('RO-002', 'Pantalón de mezclilla', 'Ropa', 260.00),
    ('RO-003', 'Chumpa impermeable', 'Ropa', 390.00),
    ('CA-001', 'Zapatos deportivos', 'Calzado', 520.00),
    ('CA-002', 'Zapatos de vestir', 'Calzado', 480.00),
    ('CA-003', 'Sandalias', 'Calzado', 150.00);

-- Cada centro arranca con 200 unidades por producto y cada tienda entre 10 y 24
insert into inventory.stock (location_id, product_id, on_hand)
select l.id, p.id,
       case when l.type = 'DISTRIBUTION_CENTER' then 200 else 10 + (l.id * p.id) % 15 end
from inventory.location l
cross join catalog.product p;

insert into inventory.stock_movement (location_id, product_id, kind, quantity, reason)
select location_id, product_id, 'IN', on_hand, 'Carga inicial'
from inventory.stock;

-- 100 clientes para poder probar muchas órdenes de personas distintas
insert into customers.customer (full_name, email, phone, address)
select 'Cliente de prueba ' || n,
       'cliente' || n || '@example.com',
       '5020' || lpad(n::text, 7, '0'),
       'Zona ' || (1 + n % 21) || ', Ciudad de Guatemala'
from generate_series(1, 100) as n;
