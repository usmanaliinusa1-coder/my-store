-- =====================================================================
-- 002_orders_payments.sql
-- coupons, coupon_usage, orders, order_items, payments, reviews,
-- notifications.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Order number generator: ORD-YYMMDD-00001 (Lagos date)
-- ---------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create or replace function public.generate_order_number()
returns text
language sql
volatile
as $$
  select 'ORD-'
      || to_char(timezone('Africa/Lagos', now()), 'YYMMDD')
      || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0');
$$;

-- ---------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  description         text,
  type                public.coupon_type not null,
  value               numeric(12,2) not null,
  min_order_amount    numeric(12,2) not null default 0,
  max_discount_amount numeric(12,2),
  usage_limit         integer,
  per_user_limit      integer default 1,
  used_count          integer not null default 0,
  starts_at           timestamptz,
  expires_at          timestamptz,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint coupons_code_unique unique (code),
  constraint coupons_code_format check (code = upper(code) and char_length(code) between 3 and 40),
  constraint coupons_value_positive check (value > 0),
  constraint coupons_percentage_max check (type <> 'percentage' or value <= 100),
  constraint coupons_min_order_nonneg check (min_order_amount >= 0),
  constraint coupons_max_discount_nonneg check (max_discount_amount is null or max_discount_amount >= 0),
  constraint coupons_usage_limit_positive check (usage_limit is null or usage_limit > 0),
  constraint coupons_per_user_positive check (per_user_limit is null or per_user_limit > 0),
  constraint coupons_used_nonneg check (used_count >= 0),
  constraint coupons_dates_valid check (starts_at is null or expires_at is null or expires_at > starts_at)
);

create index if not exists coupons_active_idx on public.coupons (is_active, expires_at);

-- ---------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_number        text not null default public.generate_order_number(),
  user_id             uuid references public.profiles (id) on delete set null,

  subtotal            numeric(12,2) not null,
  shipping_fee        numeric(12,2) not null default 0,
  discount_amount     numeric(12,2) not null default 0,
  total_amount        numeric(12,2) not null,

  coupon_id           uuid references public.coupons (id) on delete set null,
  coupon_code         text,

  -- customer snapshot (kept even if the profile changes later)
  customer_name       text not null,
  customer_email      text,
  customer_phone      text not null,

  -- delivery snapshot
  shipping_full_name  text not null,
  shipping_phone      text not null,
  shipping_address    text not null,
  shipping_city       text not null,
  shipping_state      text not null,
  shipping_landmark   text,

  payment_method      text not null default 'paystack',
  payment_status      public.payment_status not null default 'pending',
  status              public.order_status not null default 'pending',
  notes               text,

  stock_restored      boolean not null default false,
  paid_at             timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint orders_number_unique unique (order_number),
  constraint orders_payment_method_valid check (payment_method in ('paystack', 'cod')),
  constraint orders_amounts_nonneg check (
    subtotal >= 0 and shipping_fee >= 0 and discount_amount >= 0 and total_amount >= 0
  ),
  constraint orders_discount_lte_subtotal check (discount_amount <= subtotal),
  constraint orders_total_consistent check (total_amount = subtotal - discount_amount + shipping_fee)
);

create index if not exists orders_user_created_idx   on public.orders (user_id, created_at desc);
create index if not exists orders_status_idx         on public.orders (status);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_created_idx        on public.orders (created_at desc);
create index if not exists orders_coupon_idx         on public.orders (coupon_id);
create index if not exists orders_customer_email_idx on public.orders (lower(customer_email));
create index if not exists orders_abandoned_idx
  on public.orders (created_at) where payment_status = 'pending' and status = 'pending';

-- ---------------------------------------------------------------------
-- order_items  (unit_price = PRICE AT TIME OF PURCHASE)
-- ---------------------------------------------------------------------
create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  product_name      text not null,
  product_image_url text,
  unit_price        numeric(12,2) not null,
  quantity          integer not null,
  line_total        numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at        timestamptz not null default now(),
  constraint order_items_order_product_unique unique (order_id, product_id),
  constraint order_items_price_nonneg check (unit_price >= 0),
  constraint order_items_quantity_positive check (quantity > 0)
);

create index if not exists order_items_order_idx   on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- ---------------------------------------------------------------------
-- coupon_usage
-- ---------------------------------------------------------------------
create table if not exists public.coupon_usage (
  id              uuid primary key default gen_random_uuid(),
  coupon_id       uuid not null references public.coupons (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  order_id        uuid not null references public.orders (id) on delete cascade,
  discount_amount numeric(12,2) not null,
  created_at      timestamptz not null default now(),
  constraint coupon_usage_order_unique unique (order_id),
  constraint coupon_usage_discount_nonneg check (discount_amount >= 0)
);

create index if not exists coupon_usage_coupon_user_idx on public.coupon_usage (coupon_id, user_id);

-- ---------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete restrict,
  reference        text not null,
  amount           numeric(12,2) not null,
  currency         text not null default 'NGN',
  status           text not null default 'pending',
  gateway          text not null default 'paystack',
  channel          text,
  gateway_response text,
  paid_at          timestamptz,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint payments_reference_unique unique (reference),
  constraint payments_amount_nonneg check (amount >= 0),
  constraint payments_currency_len check (char_length(currency) = 3),
  constraint payments_status_valid check (status in ('pending', 'success', 'failed', 'abandoned', 'refunded'))
);

create index if not exists payments_order_idx  on public.payments (order_id);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

-- ---------------------------------------------------------------------
-- reviews (verified purchasers only: enforced by trigger + RLS)
-- ---------------------------------------------------------------------
create table if not exists public.reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  product_id    uuid not null references public.products (id) on delete cascade,
  order_item_id uuid references public.order_items (id) on delete set null,
  rating        smallint not null,
  comment       text,
  status        public.review_status not null default 'approved',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint reviews_user_product_unique unique (user_id, product_id),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_comment_len check (comment is null or char_length(comment) <= 2000)
);

create index if not exists reviews_product_status_idx on public.reviews (product_id, status, created_at desc);
create index if not exists reviews_order_item_idx     on public.reviews (order_item_id);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'general',
  title      text not null,
  message    text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);
