alter table customers.customer add column active boolean not null default true;
alter table customers.customer add column auth_version integer not null default 0;
alter table payments.credit_charge add column repayment_error text;
alter table orders.incident add column replacement_order_id bigint unique references orders.purchase_order(id);
create table customers.password_reset (
    id bigint generated always as identity primary key,
    customer_id bigint not null references customers.customer(id),
    token_hash text not null unique,
    token_encrypted text not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default now()
);
create index on customers.password_reset(customer_id,created_at desc);
grant select,insert,update on customers.password_reset to sgologic_app;
grant usage,select on sequence customers.password_reset_id_seq to sgologic_app;
