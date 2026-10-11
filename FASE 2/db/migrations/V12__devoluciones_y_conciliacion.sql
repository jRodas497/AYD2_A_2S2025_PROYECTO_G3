alter table payments.credit_charge add column voided_at timestamptz, add column repayment_reference text;
create table payments.refund (
 id bigint generated always as identity primary key,
 order_id bigint not null unique references orders.purchase_order(id),
 amount numeric(12,2) not null check(amount>0),
 provider_reference text,
 status_id smallint not null default 1 references config.delivery_status(id),
 created_at timestamptz not null default now(),
 refunded_at timestamptz
);
create table integration.erp_batch_refund (
 refund_id bigint primary key references payments.refund(id),
 batch_id bigint not null references integration.erp_batch(id)
);
insert into config.setting(key,value,description) values ('refund.finance_threshold_q','3900','Umbral en quetzales que requiere aprobación de Finanzas para devolución');
grant select,insert,update on payments.refund to sgologic_app;
grant select,insert on integration.erp_batch_refund to sgologic_app;
grant usage,select on all sequences in schema payments to sgologic_app;
create or replace view integration.erp_batch_summary as
select b.id,b.window_start,b.window_end,f.code as format,b.file_name,s.code as status,b.created_at,b.sent_at,
 (select count(*) from integration.erp_batch_order e where e.batch_id=b.id)+(select count(*) from integration.erp_batch_refund r where r.batch_id=b.id) as order_count,
 coalesce((select sum(o.total) from integration.erp_batch_order e join orders.purchase_order o on o.id=e.order_id where e.batch_id=b.id),0)
 -coalesce((select sum(r.amount) from integration.erp_batch_refund e join payments.refund r on r.id=e.refund_id where e.batch_id=b.id),0) as total_amount
from integration.erp_batch b join integration.file_format f on f.id=b.format_id join config.delivery_status s on s.id=b.status_id;
