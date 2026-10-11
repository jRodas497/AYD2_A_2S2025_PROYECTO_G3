insert into inventory.location_type values(3,'WAREHOUSE','Bodega');
alter table inventory.location add column address text not null default '';
alter table inventory.location add column active boolean not null default true;
insert into logistics.carrier(id,code,name) values(3,'MANUAL','Transporte alternativo');
alter table logistics.shipment add column carrier_name text;
alter table logistics.shipment add column driver_name text;
alter table logistics.shipment add column vehicle_plate text;
alter table logistics.shipment add column transport_reason text;

create table inventory.stock_transfer (
 id bigint generated always as identity primary key,
 request_key text unique,
 payload_hash text,
 source_id bigint not null references inventory.location(id),
 destination_id bigint not null references inventory.location(id),
 order_id bigint references orders.purchase_order(id),
 status text not null default 'PENDING' check(status in ('PENDING','IN_TRANSIT','RECEIVED','CANCELLED')),
 reason text not null,
 actor text not null,
 carrier_name text,
 transport_reference text unique,
 last_error text,
 created_at timestamptz not null default now(),
 dispatched_at timestamptz,
 received_at timestamptz,
 check(source_id<>destination_id)
);
create index on inventory.stock_transfer(order_id);
create table inventory.stock_transfer_item (
 id bigint generated always as identity primary key,
 transfer_id bigint not null references inventory.stock_transfer(id),
 product_id bigint not null references catalog.product(id),
 quantity integer not null check(quantity>0),
 reservation_id bigint unique references inventory.reservation(id)
);
alter table inventory.reservation add column transfer_id bigint references inventory.stock_transfer(id);
create index on inventory.reservation(transfer_id) where transfer_id is not null;
create table inventory.stock_transfer_event (
 id bigint generated always as identity primary key,
 transfer_id bigint not null references inventory.stock_transfer(id),
 status text not null,
 detail text not null,
 actor text not null,
 created_at timestamptz not null default now()
);
grant select,insert,update on inventory.stock_transfer,inventory.stock_transfer_item,inventory.stock_transfer_event to sgologic_app;
grant usage,select on sequence inventory.stock_transfer_id_seq,inventory.stock_transfer_item_id_seq,inventory.stock_transfer_event_id_seq to sgologic_app;
