alter table integration.erp_batch add column attempts integer not null default 0, add column last_error text;
create or replace view integration.erp_batch_summary as
select b.id,b.window_start,b.window_end,f.code as format,b.file_name,s.code as status,b.created_at,b.sent_at,
 (select count(*) from integration.erp_batch_order e where e.batch_id=b.id)+(select count(*) from integration.erp_batch_refund r where r.batch_id=b.id) as order_count,
 coalesce((select sum(o.total) from integration.erp_batch_order e join orders.purchase_order o on o.id=e.order_id where e.batch_id=b.id),0)
 -coalesce((select sum(r.amount) from integration.erp_batch_refund e join payments.refund r on r.id=e.refund_id where e.batch_id=b.id),0) as total_amount,
 b.attempts,b.last_error
from integration.erp_batch b join integration.file_format f on f.id=b.format_id join config.delivery_status s on s.id=b.status_id;
