-- =====================================================================
-- 004_functions_triggers.sql
-- updated_at triggers, auth->profile sync, privilege protection,
-- review verification, rating aggregation, order state machine,
-- coupon logic, create_order() RPC, mark_order_paid(), cleanup.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','categories','products','addresses','cart_items',
    'site_settings','coupons','orders','payments','reviews'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 2. New auth user -> profile (role is ALWAYS customer; metadata is ignored for role)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), ''),
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 30), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_auth_email_change();

-- Back-fill profiles for any users that already exist
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------
-- 3. Customers cannot change their own role / disabled flag / email
--    (auth.uid() is null for the SQL editor and the service role.)
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_disabled is distinct from old.is_disabled
       or new.id is distinct from old.id then
      raise exception 'FORBIDDEN: you cannot change privileged profile fields'
        using errcode = '42501';
    end if;
    new.email := old.email;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect on public.profiles;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- ---------------------------------------------------------------------
-- 4. Reviews: verified purchase rule + protected columns + rating cache
-- ---------------------------------------------------------------------
create or replace function public.validate_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new; -- SQL editor / service role (e.g. data import)
  end if;

  if new.order_item_id is null then
    raise exception 'REVIEW_NOT_ALLOWED: an order item is required to review' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = new.order_item_id
      and oi.product_id = new.product_id
      and o.user_id = new.user_id
      and o.payment_status = 'paid'
      and o.status <> 'cancelled'
  ) then
    raise exception 'REVIEW_NOT_ALLOWED: only verified purchasers can review this product'
      using errcode = '42501';
  end if;

  -- customers cannot choose their own moderation status
  if not public.is_admin() then
    new.status := 'approved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_validate_insert on public.reviews;
create trigger trg_reviews_validate_insert
  before insert on public.reviews
  for each row execute function public.validate_review_insert();

create or replace function public.protect_review_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.user_id       := old.user_id;
    new.product_id    := old.product_id;
    new.order_item_id := old.order_item_id;
    new.status        := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_protect on public.reviews;
create trigger trg_reviews_protect
  before update on public.reviews
  for each row execute function public.protect_review_columns();

create or replace function public.refresh_product_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set rating_count = (select count(*) from public.reviews r
                         where r.product_id = v_pid and r.status = 'approved'),
         rating_avg   = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r
                                  where r.product_id = v_pid and r.status = 'approved'), 0)
   where p.id = v_pid;
  return null;
end;
$$;

drop trigger if exists trg_reviews_rating on public.reviews;
create trigger trg_reviews_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- ---------------------------------------------------------------------
-- 5. Single default address per user / primary image sync
-- ---------------------------------------------------------------------
-- BEFORE trigger so the partial unique index never sees two defaults
create or replace function public.enforce_single_default_address_before()
returns trigger
language plpgsql
as $$
begin
  if new.is_default then
    update public.addresses
       set is_default = false
     where user_id = new.user_id and id is distinct from new.id and is_default;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_addresses_single_default on public.addresses;
create trigger trg_addresses_single_default
  before insert or update of is_default on public.addresses
  for each row execute function public.enforce_single_default_address_before();

create or replace function public.sync_product_primary_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set image_url = (select pi.url from public.product_images pi
                      where pi.product_id = v_pid
                      order by pi.is_primary desc, pi.sort_order, pi.created_at
                      limit 1)
   where p.id = v_pid;
  return null;
end;
$$;

drop trigger if exists trg_product_images_sync on public.product_images;
create trigger trg_product_images_sync
  after insert or update or delete on public.product_images
  for each row execute function public.sync_product_primary_image();

-- ---------------------------------------------------------------------
-- 6. Order state machine
--    * cancelled orders can't be reopened
--    * cancelling restores stock + releases the coupon (once)
--    * becoming paid sets paid_at and bumps products.sales_count
-- ---------------------------------------------------------------------
create or replace function public.orders_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'ORDER_CANCELLED: a cancelled order cannot be reopened' using errcode = 'P0001';
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    if not new.stock_restored then
      update public.products p
         set stock = p.stock + oi.quantity
        from public.order_items oi
       where oi.order_id = new.id and oi.product_id is not null and p.id = oi.product_id;

      if new.coupon_id is not null then
        update public.coupons set used_count = greatest(used_count - 1, 0)
         where id = new.coupon_id;
        delete from public.coupon_usage where order_id = new.id;
      end if;
      new.stock_restored := true;
    end if;
  end if;

  if new.payment_status = 'paid' and old.payment_status <> 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
    update public.products p
       set sales_count = p.sales_count + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id is not null and p.id = oi.product_id;
  end if;

  if new.status = 'delivered' and old.status <> 'delivered' then
    new.delivered_at := coalesce(new.delivered_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_orders_before_update on public.orders;
create trigger trg_orders_before_update
  before update on public.orders
  for each row execute function public.orders_before_update();

-- Customer notifications for order events
create or replace function public.notify_order_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.user_id, 'order', 'Order placed',
            'Your order ' || new.order_number || ' has been received.',
            '/account/orders/' || new.id);
  elsif new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.user_id, 'payment', 'Payment received',
            'We received your payment for order ' || new.order_number || '.',
            '/account/orders/' || new.id);
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message, link)
    values (new.user_id, 'order', 'Order update',
            'Order ' || new.order_number || ' is now ' || new.status::text || '.',
            '/account/orders/' || new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orders_notify on public.orders;
create trigger trg_orders_notify
  after insert or update of status, payment_status on public.orders
  for each row execute function public.notify_order_events();

-- ---------------------------------------------------------------------
-- 7. Coupons
-- ---------------------------------------------------------------------
-- Internal: raises 'COUPON_INVALID: <reason>' or returns the discount.
create or replace function public.calculate_coupon_discount(
  p_coupon   public.coupons,
  p_subtotal numeric,
  p_user_id  uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_discount numeric;
  v_used     integer;
begin
  if not p_coupon.is_active then
    raise exception 'COUPON_INVALID: this coupon is not active';
  end if;
  if p_coupon.starts_at is not null and p_coupon.starts_at > now() then
    raise exception 'COUPON_INVALID: this coupon is not valid yet';
  end if;
  if p_coupon.expires_at is not null and p_coupon.expires_at <= now() then
    raise exception 'COUPON_INVALID: this coupon has expired';
  end if;
  if p_coupon.usage_limit is not null and p_coupon.used_count >= p_coupon.usage_limit then
    raise exception 'COUPON_INVALID: this coupon has reached its usage limit';
  end if;
  if p_subtotal < p_coupon.min_order_amount then
    raise exception 'COUPON_INVALID: minimum order of NGN % required', p_coupon.min_order_amount;
  end if;
  if p_user_id is not null and p_coupon.per_user_limit is not null then
    select count(*) into v_used
      from public.coupon_usage cu
     where cu.coupon_id = p_coupon.id and cu.user_id = p_user_id;
    if v_used >= p_coupon.per_user_limit then
      raise exception 'COUPON_INVALID: you have already used this coupon';
    end if;
  end if;

  if p_coupon.type = 'percentage' then
    v_discount := p_subtotal * p_coupon.value / 100;
    if p_coupon.max_discount_amount is not null then
      v_discount := least(v_discount, p_coupon.max_discount_amount);
    end if;
  else
    v_discount := p_coupon.value;
  end if;

  return round(least(v_discount, p_subtotal), 2);
end;
$$;

-- Public RPC for the cart page (preview only; create_order recalculates)
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_coupon   public.coupons%rowtype;
  v_discount numeric;
begin
  select * into v_coupon from public.coupons
   where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return jsonb_build_object('valid', false, 'message', 'Invalid coupon code');
  end if;

  v_discount := public.calculate_coupon_discount(v_coupon, coalesce(p_subtotal, 0), auth.uid());
  return jsonb_build_object('valid', true, 'code', v_coupon.code,
                            'discount', v_discount, 'message', 'Coupon applied');
exception when others then
  return jsonb_build_object('valid', false,
           'message', regexp_replace(sqlerrm, '^COUPON_INVALID: ', ''));
end;
$$;

-- ---------------------------------------------------------------------
-- 8. create_order(): the ONLY way customers create orders.
--    Prices, stock, coupon, shipping and totals all come from the DB.
--    Rows are locked with SELECT ... FOR UPDATE in a fixed (id) order, so
--    concurrent buyers cannot oversell and cannot deadlock each other.
--    Everything is one transaction: any error rolls it all back.
--
--    p_items example: [{"product_id":"<uuid>","quantity":2}, ...]
--    Returns: {order_id, order_number, total_amount, payment_method, payment_status}
-- ---------------------------------------------------------------------
create or replace function public.create_order(
  p_items              jsonb,
  p_customer_name      text,
  p_customer_phone     text,
  p_shipping_full_name text,
  p_shipping_phone     text,
  p_shipping_address   text,
  p_shipping_city      text,
  p_shipping_state     text,
  p_shipping_landmark  text default null,
  p_payment_method     text default 'paystack',
  p_coupon_code        text default null,
  p_notes              text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_profile  public.profiles%rowtype;
  v_email    text;
  v_settings public.site_settings%rowtype;
  v_line     record;
  v_product  public.products%rowtype;
  v_coupon   public.coupons%rowtype;
  v_code     text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');

  v_ids      uuid[]    := '{}';
  v_qtys     integer[] := '{}';
  v_prices   numeric[] := '{}';
  v_names    text[]    := '{}';
  v_images   text[]    := '{}';

  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total    numeric(12,2);

  v_order_id     uuid;
  v_order_number text;
begin
  -- Authentication / account checks -----------------------------------
  if v_uid is null then
    raise exception 'AUTH_REQUIRED: please sign in to place an order' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.is_disabled then
    raise exception 'ACCOUNT_DISABLED: this account cannot place orders' using errcode = '42501';
  end if;
  select email into v_email from auth.users where id = v_uid;

  -- Input validation ----------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'INVALID_INPUT: cart is empty or invalid';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    where x.product_id is null or x.quantity is null or x.quantity < 1 or x.quantity > 100
  ) then
    raise exception 'INVALID_INPUT: each item needs a product_id and a quantity between 1 and 100';
  end if;

  if coalesce(trim(p_customer_name), '') = ''
     or coalesce(trim(p_customer_phone), '') = ''
     or coalesce(trim(p_shipping_full_name), '') = ''
     or coalesce(trim(p_shipping_phone), '') = ''
     or coalesce(trim(p_shipping_address), '') = ''
     or coalesce(trim(p_shipping_city), '') = ''
     or coalesce(trim(p_shipping_state), '') = '' then
    raise exception 'INVALID_INPUT: customer and delivery details are required';
  end if;

  if char_length(p_customer_name) > 120 or char_length(p_shipping_full_name) > 120
     or char_length(p_customer_phone) > 30 or char_length(p_shipping_phone) > 30
     or char_length(p_shipping_address) > 300 or char_length(p_shipping_city) > 100
     or char_length(p_shipping_state) > 100
     or char_length(coalesce(p_shipping_landmark, '')) > 200
     or char_length(coalesce(p_notes, '')) > 1000 then
    raise exception 'INVALID_INPUT: one or more fields are too long';
  end if;

  if p_payment_method not in ('paystack', 'cod') then
    raise exception 'INVALID_INPUT: unsupported payment method';
  end if;

  select * into v_settings from public.site_settings where id = 1;
  if not found then
    raise exception 'SETTINGS_MISSING: store settings are not configured';
  end if;
  if p_payment_method = 'cod' and not v_settings.cod_enabled then
    raise exception 'COD_DISABLED: cash on delivery is not available';
  end if;

  -- Lock products (sorted by id => consistent lock order), validate, price --
  for v_line in
    select x.product_id, sum(x.quantity)::integer as quantity
      from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
     group by x.product_id
     order by x.product_id
  loop
    if v_line.quantity > 100 then
      raise exception 'INVALID_INPUT: quantity too large for one product';
    end if;

    select * into v_product from public.products where id = v_line.product_id for update;

    if not found or not v_product.is_active then
      raise exception 'PRODUCT_UNAVAILABLE: a product in your cart is no longer available';
    end if;
    if v_product.stock < v_line.quantity then
      raise exception 'INSUFFICIENT_STOCK: only % left of "%"', v_product.stock, v_product.name;
    end if;

    v_ids    := array_append(v_ids,    v_product.id);
    v_qtys   := array_append(v_qtys,   v_line.quantity);
    v_prices := array_append(v_prices, v_product.price);          -- price from the DB
    v_names  := array_append(v_names,  v_product.name);
    v_images := array_append(v_images, v_product.image_url);
    v_subtotal := v_subtotal + (v_product.price * v_line.quantity);
  end loop;

  -- Coupon (row locked so used_count / usage_limit can't race) -----------
  if v_code is not null then
    select * into v_coupon from public.coupons where code = v_code for update;
    if not found then
      raise exception 'COUPON_INVALID: coupon code not found';
    end if;
    v_discount := public.calculate_coupon_discount(v_coupon, v_subtotal, v_uid);
  end if;

  -- Shipping: free when (subtotal - discount) reaches the threshold -----
  if v_settings.free_delivery_threshold is not null
     and v_settings.free_delivery_threshold > 0
     and (v_subtotal - v_discount) >= v_settings.free_delivery_threshold then
    v_shipping := 0;
  else
    v_shipping := v_settings.delivery_fee;
  end if;

  v_total := v_subtotal - v_discount + v_shipping;

  -- Create the order (payment ALWAYS starts as pending) ------------------
  insert into public.orders (
    user_id, subtotal, shipping_fee, discount_amount, total_amount,
    coupon_id, coupon_code,
    customer_name, customer_email, customer_phone,
    shipping_full_name, shipping_phone, shipping_address,
    shipping_city, shipping_state, shipping_landmark,
    payment_method, payment_status, status, notes
  ) values (
    v_uid, v_subtotal, v_shipping, v_discount, v_total,
    case when v_code is not null then v_coupon.id end,
    case when v_code is not null then v_coupon.code end,
    trim(p_customer_name), v_email, trim(p_customer_phone),
    trim(p_shipping_full_name), trim(p_shipping_phone), trim(p_shipping_address),
    trim(p_shipping_city), trim(p_shipping_state), nullif(trim(coalesce(p_shipping_landmark, '')), ''),
    p_payment_method, 'pending', 'pending', nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id, order_number into v_order_id, v_order_number;

  -- Items with the price captured AT PURCHASE TIME -----------------------
  insert into public.order_items (order_id, product_id, product_name, product_image_url, unit_price, quantity)
  select v_order_id, i.pid, i.pname, i.img, i.price, i.qty
    from unnest(v_ids, v_names, v_images, v_prices, v_qtys) as i(pid, pname, img, price, qty);

  -- Reduce stock only now that the order exists (rows already locked) ----
  update public.products p
     set stock = p.stock - i.qty
    from unnest(v_ids, v_qtys) as i(pid, qty)
   where p.id = i.pid;   -- CHECK (stock >= 0) is the final safety net

  -- Coupon accounting ----------------------------------------------------
  if v_code is not null then
    update public.coupons set used_count = used_count + 1 where id = v_coupon.id;
    insert into public.coupon_usage (coupon_id, user_id, order_id, discount_amount)
    values (v_coupon.id, v_uid, v_order_id, v_discount);
  end if;

  -- Cash on delivery: nothing to wait for, so clear the cart now.
  -- Paystack orders clear the cart when payment is confirmed.
  if p_payment_method = 'cod' then
    delete from public.cart_items
     where user_id = v_uid and product_id = any (v_ids);
  end if;

  return jsonb_build_object(
    'order_id',       v_order_id,
    'order_number',   v_order_number,
    'total_amount',   v_total,
    'payment_method', p_payment_method,
    'payment_status', 'pending'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. mark_order_paid(): called ONLY by the Netlify functions (service
--    role) after Paystack's verify API confirmed the transaction.
--    Idempotent; refuses amount mismatches.
-- ---------------------------------------------------------------------
create or replace function public.mark_order_paid(
  p_order_id         uuid,
  p_reference        text,
  p_amount           numeric,            -- in NAIRA (kobo / 100)
  p_currency         text default 'NGN',
  p_channel          text default null,
  p_gateway_response text default null,
  p_paid_at          timestamptz default now(),
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
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND: no such order';
  end if;

  if upper(coalesce(p_currency, '')) <> 'NGN' or round(p_amount, 2) <> v_order.total_amount then
    update public.payments
       set status = 'failed',
           gateway_response = 'Amount or currency mismatch',
           metadata = metadata || jsonb_build_object('verified_amount', p_amount, 'verified_currency', p_currency)
     where reference = p_reference and order_id = p_order_id and status <> 'success';
    return jsonb_build_object('success', false, 'reason', 'amount_mismatch');
  end if;

  insert into public.payments
    (order_id, reference, amount, currency, status, gateway, channel, gateway_response, paid_at, metadata)
  values
    (p_order_id, p_reference, round(p_amount, 2), 'NGN', 'success', 'paystack',
     p_channel, p_gateway_response, p_paid_at, coalesce(p_metadata, '{}'::jsonb))
  on conflict (reference) do update
     set status = 'success',
         channel = excluded.channel,
         gateway_response = excluded.gateway_response,
         paid_at = excluded.paid_at,
         metadata = public.payments.metadata || excluded.metadata
   where public.payments.order_id = excluded.order_id;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object('success', true, 'already_paid', true, 'order_number', v_order.order_number);
  end if;

  update public.orders
     set payment_status = 'paid',
         status = case when status = 'pending' then 'processing'::public.order_status else status end
   where id = p_order_id;

  delete from public.cart_items ci
   using public.order_items oi
   where oi.order_id = p_order_id
     and ci.user_id = v_order.user_id
     and ci.product_id = oi.product_id;

  return jsonb_build_object('success', true, 'already_paid', false, 'order_number', v_order.order_number);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. cancel_abandoned_orders(): releases stock held by unpaid Paystack
--     orders. Run it on a schedule (see README / 005) or from a Netlify
--     scheduled function using the service role.
-- ---------------------------------------------------------------------
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
    update public.orders
       set status = 'cancelled', payment_status = 'failed'
     where payment_method = 'paystack'
       and payment_status = 'pending'
       and status = 'pending'
       and created_at < now() - make_interval(mins => greatest(p_minutes, 15))
    returning 1
  )
  select count(*) into v_count from cancelled;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Public reviews view (reviewer shown as "Ada O.", no user ids/emails)
-- ---------------------------------------------------------------------
create or replace view public.product_reviews_public as
select r.id,
       r.product_id,
       r.rating,
       r.comment,
       r.created_at,
       coalesce(
         nullif(split_part(coalesce(p.full_name, ''), ' ', 1), '') ||
           case when position(' ' in trim(coalesce(p.full_name, ''))) > 0
                then ' ' || upper(left(split_part(trim(p.full_name), ' ', 2), 1)) || '.'
                else '' end,
         'Customer'
       ) as reviewer_name
  from public.reviews r
  join public.profiles p on p.id = r.user_id
 where r.status = 'approved';

grant select on public.product_reviews_public to anon, authenticated;

-- ---------------------------------------------------------------------
-- 12. Function privileges
-- ---------------------------------------------------------------------
revoke all on function public.create_order(jsonb, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon;
grant execute on function public.create_order(jsonb, text, text, text, text, text, text, text, text, text, text, text)
  to authenticated;

revoke all on function public.validate_coupon(text, numeric) from public, anon;
grant execute on function public.validate_coupon(text, numeric) to authenticated;

revoke all on function public.calculate_coupon_discount(public.coupons, numeric, uuid)
  from public, anon, authenticated;

revoke all on function public.mark_order_paid(uuid, text, numeric, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, numeric, text, text, text, timestamptz, jsonb)
  to service_role;

revoke all on function public.cancel_abandoned_orders(integer) from public, anon, authenticated;
grant execute on function public.cancel_abandoned_orders(integer) to service_role;

revoke all on function public.generate_order_number() from public, anon, authenticated;
grant execute on function public.generate_order_number() to service_role;
