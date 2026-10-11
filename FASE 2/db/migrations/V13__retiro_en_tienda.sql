alter table orders.purchase_order add column pickup_location_id bigint references inventory.location(id);
insert into logistics.carrier(id,code,name) values(2,'PICKUP','Retiro en tienda');
