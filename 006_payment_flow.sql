-- =====================================================================
-- 006_payment_flow.sql  (Phase 5)  -- ADDITIVE: does not change 001-005
-- 1) mark_payment_failed(): called ONLY by Netlify Functions (service role)
-- 2) cancel_abandoned_orders(): now also releases stock held by orders whose
--    online payment failed (a failed order can be retried until it is cancelled).
-- Safe to run more than once.
-- =====================================================================

create or replace function public.mark_payment_failed(
  p_order_id         uuid,
  p_reference        text,
  p_status           text,                 -- 'failed' or 'abandoned'
  p_gateway_response text default null,
  p_channel          text default null,
  p_metadata         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_status not in ('failed', 'abandoned') then
    raise exception 'INVALID_INPUT: status must be failed or abandoned';
  end if;

  -- same lock order as mark_order_paid(): serialises with a concurrent success
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND: no such order';
  end if;

  -- a successful payment row is never downgraded
  update public.payments
     set status           = p_status,
         gateway_response = coalesce(p_gateway_response, gateway_response),
         channel          = coalesce(p_channel, channel),
         metadata         = metadata || coalesce(p_metadata, '{}'::jsonb)
   where reference = p_reference
     and order_id  = p_order_id
     and status   <> 'success';

  -- 'abandoned' keeps the order payable; only a real failure flips payment_status,
  -- and only while the order has not been paid.
  if p_status = 'failed' and v_order.payment_status = 'pending' then
    update public.orders set payment_status = 'failed' where id = p_order_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'payment_status', (select o.payment_status from public.orders o where o.id = p_order_id)
  );
end;
$$;

revoke all on function public.mark_payment_failed(uuid, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_payment_failed(uuid, text, text, text, text, jsonb)
  to service_role;

-- Release stock held by unpaid online orders (pending OR failed) after p_minutes.
create or replace function public.cancel_abandoned_orders(p_minutes integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with cancelled as (
    update public.orders o
       set status = 'cancelled', payment_status = 'failed'
     where o.payment_method = 'paystack'
       and o.payment_status in ('pending', 'failed')
       and o.status = 'pending'
       and o.created_at < now() - make_interval(mins => greatest(p_minutes, 15))
       and not exists (
         select 1 from public.payments p
          where p.order_id = o.id and p.status = 'success'
       )
    returning 1
  )
  select count(*) into v_count from cancelled;
  return v_count;
end;
$$;

revoke all on function public.cancel_abandoned_orders(integer) from public, anon, authenticated;
grant execute on function public.cancel_abandoned_orders(integer) to service_role;
