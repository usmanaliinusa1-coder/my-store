-- =====================================================================
-- 001_core_tables.sql
-- Core tables: profiles, categories, products, product_images,
-- addresses, cart_items, wishlists, site_settings.
-- Safe to re-run (idempotent where practical).
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Enums (shared with 002)
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('customer', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum
    ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coupon_type as enum ('percentage', 'fixed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users; created by trigger in 004)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  avatar_url  text,
  role        public.user_role not null default 'customer',
  is_disabled boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_full_name_len check (full_name is null or char_length(full_name) <= 120),
  constraint profiles_phone_len check (phone is null or char_length(phone) <= 30)
);

create index if not exists profiles_role_idx  on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_created_idx on public.profiles (created_at desc);

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_slug_unique unique (slug),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_name_len check (char_length(name) between 1 and 120)
);

create index if not exists categories_active_sort_idx on public.categories (is_active, sort_order);

-- ---------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  category_id      uuid references public.categories (id) on delete set null,
  name             text not null,
  slug             text not null,
  description      text,
  price            numeric(12,2) not null,
  compare_price    numeric(12,2),
  stock            integer not null default 0,
  image_url        text,
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  sales_count      integer not null default 0,
  rating_avg       numeric(3,2) not null default 0,
  rating_count     integer not null default 0,
  meta_title       text,
  meta_description text,
  -- derived columns (no need to compute in the app)
  discount_percent integer generated always as (
    case when compare_price is not null and compare_price > price and compare_price > 0
         then round(((compare_price - price) / compare_price) * 100)::integer
         else 0 end
  ) stored,
  search_vector    tsvector generated always as (
    to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_slug_unique unique (slug),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_name_len check (char_length(name) between 1 and 200),
  constraint products_price_nonneg check (price >= 0),
  constraint products_compare_price_valid check (compare_price is null or compare_price >= price),
  constraint products_stock_nonneg check (stock >= 0),
  constraint products_sales_nonneg check (sales_count >= 0)
);

create index if not exists products_category_idx     on public.products (category_id);
create index if not exists products_active_created_idx on public.products (is_active, created_at desc);
create index if not exists products_featured_idx     on public.products (is_featured) where is_active and is_featured;
create index if not exists products_discount_idx     on public.products (discount_percent desc) where is_active and discount_percent > 0;
create index if not exists products_bestseller_idx   on public.products (sales_count desc) where is_active;
create index if not exists products_price_idx        on public.products (price);
create index if not exists products_search_idx       on public.products using gin (search_vector);
create index if not exists products_name_trgm_idx    on public.products using gin (name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- product_images (multiple per product)
-- ---------------------------------------------------------------------
create table if not exists public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  url          text not null,
  storage_path text,
  alt_text     text,
  sort_order   integer not null default 0,
  is_primary   boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------
create table if not exists public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  label        text,
  full_name    text not null,
  phone        text not null,
  address_line text not null,
  city         text not null,
  state        text not null,
  landmark     text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint addresses_lengths check (
    char_length(full_name) <= 120 and char_length(phone) <= 30 and
    char_length(address_line) <= 300 and char_length(city) <= 100 and char_length(state) <= 100
  )
);

create index if not exists addresses_user_idx on public.addresses (user_id);
create unique index if not exists addresses_one_default_per_user
  on public.addresses (user_id) where is_default;

-- ---------------------------------------------------------------------
-- cart_items (server-side cart)
-- ---------------------------------------------------------------------
create table if not exists public.cart_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity   integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_user_product_unique unique (user_id, product_id),
  constraint cart_items_quantity_range check (quantity between 1 and 100)
);

create index if not exists cart_items_product_idx on public.cart_items (product_id);

-- ---------------------------------------------------------------------
-- wishlists
-- ---------------------------------------------------------------------
create table if not exists public.wishlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint wishlists_user_product_unique unique (user_id, product_id)
);

create index if not exists wishlists_product_idx on public.wishlists (product_id);

-- ---------------------------------------------------------------------
-- site_settings (singleton row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.site_settings (
  id                      smallint primary key default 1,
  store_name              text not null default 'MY STORE',
  tagline                 text,
  logo_url                text,
  whatsapp_number         text not null default '2348000000000',
  contact_email           text not null default 'support@example.com',
  contact_phone           text,
  store_address           text,
  delivery_fee            numeric(12,2) not null default 2500,
  free_delivery_threshold numeric(12,2) default 50000,
  cod_enabled             boolean not null default false,
  facebook_url            text,
  instagram_url           text,
  twitter_url             text,
  tiktok_url              text,
  meta_description        text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint site_settings_singleton check (id = 1),
  constraint site_settings_delivery_fee_nonneg check (delivery_fee >= 0),
  constraint site_settings_threshold_nonneg check (free_delivery_threshold is null or free_delivery_threshold >= 0)
);
