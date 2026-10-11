create table integration.erp_customer_history (
 customer_id bigint primary key references customers.customer(id),
 customer_key text not null,
 snapshot jsonb not null,
 fetched_at timestamptz not null default now()
);
create table payments.credit_application (
 id bigint generated always as identity primary key,
 customer_id bigint not null references customers.customer(id),
 order_id bigint not null references orders.purchase_order(id),
 amount numeric(14,2) not null,
 status text not null check(status in ('APPROVED','DECLINED')),
 reason text not null,
 assessment jsonb not null,
 created_at timestamptz not null default now()
);
create index on payments.credit_application(customer_id,created_at desc);
alter table orders.purchase_order add column payment_preference text not null default 'CARD'
 check(payment_preference in ('CARD','TRANSFER','WALLET','CREDIT'));
alter table payments.credit_charge add column return_pending boolean not null default false;
alter table payments.credit_charge add column repayment_lease_until timestamptz;
alter table payments.refund add column waiting_for_repayment boolean not null default false;
insert into config.setting(key,value,description) values
 ('credit.minimum_purchase_amount','30','Importe neto mínimo de compras entregadas, incluyendo ERP'),
 ('credit.maximum_confirmed_incidents','0','Incidencias confirmadas permitidas para crédito'),
 ('credit.maximum_returns','0','Devoluciones confirmadas permitidas para crédito'),
 ('credit.maximum_late_payments','0','Pagos fuera de plazo permitidos para crédito'),
 ('credit.maximum_declined_payments','0','Rechazos de pago permitidos para crédito');
grant select,insert,update on integration.erp_customer_history,payments.credit_application to sgologic_app;
grant usage,select on sequence payments.credit_application_id_seq to sgologic_app;
