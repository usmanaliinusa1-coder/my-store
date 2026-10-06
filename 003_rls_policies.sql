-- =====================================================================
-- 003_rls_policies.sql
-- Admin helper + Row Level Security for every table.
-- Customers can NEVER create/modify orders, order_items, payments or
-- coupon_usage directly: those are written only by SECURITY DEFINER
-- functions (004) or by the Netlify functions using the service role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Admin check (server-side, reads profiles.role). SECURITY DEFINER so it
-- bypasses RLS on profiles (avoids recursion). Returns false if not
-- signed in or the account is disabled.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_disabled = false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses      enable row level security;
alter table public.cart_items     enable row level security;
alter table public.wishlists      enable row level security;
alter table public.site_settings  enable row level security;
alter table public.coupons        enable row level security;
alter table public.coupon_usage   enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.payments       enable row level security;
alter table public.reviews        enable row level security;
alter table public.notifications  enable row level security;

-- ---------------------------------------------------------------------
-- Defense in depth: table privileges
-- (RLS still applies on top of whatever is granted.)
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.addresses, public.cart_items, public.wishlists,
              public.orders, public.order_items, public.payments,
              public.coupons, public.coupon_usage, public.notifications
  from anon;

revoke insert, delete on public.orders, public.order_items, public.payments, public.coupon_usage
  from authenticated;
revoke update on public.order_items, public.coupon_usage from authenticated;
revoke insert, delete on public.profiles from authenticated;

-- Customers may only flip is_read on their notifications
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- profiles
-- (role / is_disabled / email are protected by a trigger in 004)
-- ---------------------------------------------------------------------
drop policy if exists profiles_select_own   on public.profiles;
drop policy if exists profiles_update_own   on public.profiles;
drop policy if exists profiles_admin_select on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_select on public.profiles
  for select to authenticated using (public.is_admin());
create policy profiles_admin_update on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- categories (public: active only)
-- ---------------------------------------------------------------------
drop policy if exists categories_public_read on public.categories;
drop policy if exists categories_admin_all   on public.categories;

create policy categories_public_read on public.categories
  for select to anon, authenticated using (is_active);
create policy categories_admin_all on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- products (public: active only)
-- ---------------------------------------------------------------------
drop policy if exists products_public_read on public.products;
drop policy if exists products_admin_all   on public.products;

create policy products_public_read on public.products
  for select to anon, authenticated using (is_active);
create policy products_admin_all on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- product_images (public: only for active products)
-- ---------------------------------------------------------------------
drop policy if exists product_images_public_read on public.product_images;
drop policy if exists product_images_admin_all   on public.product_images;

create policy product_images_public_read on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active));
create policy product_images_admin_all on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- addresses (owner only)
-- ---------------------------------------------------------------------
drop policy if exists addresses_owner_all  on public.addresses;
drop policy if exists addresses_admin_read on public.addresses;

create policy addresses_owner_all on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy addresses_admin_read on public.addresses
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- cart_items (owner only; only active products can be added)
-- ---------------------------------------------------------------------
drop policy if exists cart_items_owner_select on public.cart_items;
drop policy if exists cart_items_owner_write  on public.cart_items;
drop policy if exists cart_items_owner_update on public.cart_items;
drop policy if exists cart_items_owner_delete on public.cart_items;

create policy cart_items_owner_select on public.cart_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy cart_items_owner_write on public.cart_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy cart_items_owner_update on public.cart_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy cart_items_owner_delete on public.cart_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- wishlists (owner only)
-- ---------------------------------------------------------------------
drop policy if exists wishlists_owner_select on public.wishlists;
drop policy if exists wishlists_owner_insert on public.wishlists;
drop policy if exists wishlists_owner_delete on public.wishlists;

create policy wishlists_owner_select on public.wishlists
  for select to authenticated using (user_id = (select auth.uid()));
create policy wishlists_owner_insert on public.wishlists
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.products p where p.id = product_id and p.is_active)
  );
create policy wishlists_owner_delete on public.wishlists
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- site_settings (public read, admin write)
-- ---------------------------------------------------------------------
drop policy if exists site_settings_public_read  on public.site_settings;
drop policy if exists site_settings_admin_insert on public.site_settings;
drop policy if exists site_settings_admin_update on public.site_settings;

create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated using (true);
create policy site_settings_admin_insert on public.site_settings
  for insert to authenticated with check (public.is_admin());
create policy site_settings_admin_update on public.site_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- coupons (admin only; customers validate through validate_coupon())
-- ---------------------------------------------------------------------
drop policy if exists coupons_admin_all on public.coupons;
create policy coupons_admin_all on public.coupons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- coupon_usage (read only)
-- ---------------------------------------------------------------------
drop policy if exists coupon_usage_owner_select on public.coupon_usage;
drop policy if exists coupon_usage_admin_select on public.coupon_usage;

create policy coupon_usage_owner_select on public.coupon_usage
  for select to authenticated using (user_id = (select auth.uid()));
create policy coupon_usage_admin_select on public.coupon_usage
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- orders (customer: read own. admin: read + update. No direct inserts.)
-- ---------------------------------------------------------------------
drop policy if exists orders_owner_select on public.orders;
drop policy if exists orders_admin_select on public.orders;
drop policy if exists orders_admin_update on public.orders;

create policy orders_owner_select on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
create policy orders_admin_select on public.orders
  for select to authenticated using (public.is_admin());
create policy orders_admin_update on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- order_items (read only)
-- ---------------------------------------------------------------------
drop policy if exists order_items_owner_select on public.order_items;
drop policy if exists order_items_admin_select on public.order_items;

create policy order_items_owner_select on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and o.user_id = (select auth.uid())));
create policy order_items_admin_select on public.order_items
  for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- payments (customer: read own. admin: read + update. Writes: service role.)
-- ---------------------------------------------------------------------
drop policy if exists payments_owner_select on public.payments;
drop policy if exists payments_admin_select on public.payments;
drop policy if exists payments_admin_update on public.payments;

create policy payments_owner_select on public.payments
  for select to authenticated
  using (exists (select 1 from public.orders o
                 where o.id = order_id and o.user_id = (select auth.uid())));
create policy payments_admin_select on public.payments
  for select to authenticated using (public.is_admin());
create policy payments_admin_update on public.payments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- reviews
-- Insert is allowed for the signed-in user only; the BEFORE INSERT
-- trigger (004) verifies the purchase (paid, not cancelled, same product).
-- ---------------------------------------------------------------------
drop policy if exists reviews_public_read   on public.reviews;
drop policy if exists reviews_owner_insert  on public.reviews;
drop policy if exists reviews_owner_update  on public.reviews;
drop policy if exists reviews_owner_delete  on public.reviews;
drop policy if exists reviews_admin_all     on public.reviews;

create policy reviews_public_read on public.reviews
  for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or public.is_admin());
create policy reviews_owner_insert on public.reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy reviews_owner_update on public.reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reviews_owner_delete on public.reviews
  for delete to authenticated using (user_id = (select auth.uid()));
create policy reviews_admin_all on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- notifications (owner reads / marks read / deletes; admin can create)
-- ---------------------------------------------------------------------
drop policy if exists notifications_owner_select on public.notifications;
drop policy if exists notifications_owner_update on public.notifications;
drop policy if exists notifications_owner_delete on public.notifications;
drop policy if exists notifications_admin_insert on public.notifications;

create policy notifications_owner_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_owner_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_owner_delete on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));
create policy notifications_admin_insert on public.notifications
  for insert to authenticated with check (public.is_admin());
