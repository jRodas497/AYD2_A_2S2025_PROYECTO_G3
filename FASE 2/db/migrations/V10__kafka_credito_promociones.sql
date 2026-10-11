alter table integration.outbox add column kafka_published_at timestamptz, add column relay_lease_until timestamptz;
alter table notifications.notification add column kafka_published_at timestamptz, add column relay_lease_until timestamptz;
alter table integration.pos_event add column kafka_published_at timestamptz, add column relay_lease_until timestamptz;
alter table integration.erp_batch add column kafka_published_at timestamptz, add column relay_lease_until timestamptz;
create index on integration.outbox(id) where status_id=1 and kafka_published_at is null;
create index on notifications.notification(id) where status_id=1 and kafka_published_at is null;
create index on integration.pos_event(id) where status_id=1 and kafka_published_at is null;

create table payments.credit_charge (
  id bigint generated always as identity primary key,
  customer_id bigint not null references customers.customer(id),
  order_id bigint not null unique references orders.purchase_order(id),
  amount numeric(12,2) not null check(amount>0),
  due_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index on payments.credit_charge(customer_id, due_at) where paid_at is null;
insert into config.setting(key,value,description) values
 ('credit.minimum_delivered_orders','3','Compras entregadas requeridas para crédito'),
 ('credit.limit','5000','Límite de crédito por cliente en quetzales'),
 ('credit.term_days','30','Plazo para pagar las compras a crédito');

create table catalog.promotion (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  discount_percent numeric(5,2) not null check(discount_percent>0 and discount_percent<=100),
  category_id smallint not null references catalog.product_category(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  check(ends_at>starts_at)
);
grant select,insert,update on payments.credit_charge, catalog.promotion to sgologic_app;
grant usage,select on all sequences in schema payments,catalog to sgologic_app;
-- Production orders snapshot their discounted unit price; historical prices never change.
