alter table integration.erp_batch add column file_content text;
create table payments.payment_intent (
 order_id bigint primary key references orders.purchase_order(id),
 card_token text,
 method text not null,
 updated_at timestamptz not null default now()
);
grant select,insert,update on payments.payment_intent to sgologic_app;
