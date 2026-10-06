-- =====================================================================
-- 005_storage_seed.sql
-- Storage buckets + policies, safe seed data.
-- No fake customers, orders or payments are created.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Buckets (public read; only admins can write)
--   product-images : products/<product-id>/..., categories/...
--   store-assets   : logo and other site images
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('store-assets', 'store-assets', true, 2097152,
   array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "store_images_public_read"  on storage.objects;
drop policy if exists "store_images_admin_insert" on storage.objects;
drop policy if exists "store_images_admin_update" on storage.objects;
drop policy if exists "store_images_admin_delete" on storage.objects;

create policy "store_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('product-images', 'store-assets'));

create policy "store_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'store-assets') and public.is_admin());

create policy "store_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'store-assets') and public.is_admin())
  with check (bucket_id in ('product-images', 'store-assets') and public.is_admin());

create policy "store_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'store-assets') and public.is_admin());

-- ---------------------------------------------------------------------
-- Seed: the single settings row (values come from column defaults)
-- ---------------------------------------------------------------------
insert into public.site_settings (id) values (1) on conflict (id) do nothing;

-- Seed: starter categories (editable / deletable from the admin panel)
insert into public.categories (name, slug, description, sort_order) values
  ('Fashion',          'fashion',          'Clothing, shoes and accessories',        1),
  ('Electronics',      'electronics',      'Phones, gadgets and accessories',        2),
  ('Home & Kitchen',   'home-kitchen',     'Everything for your home',               3),
  ('Beauty & Health',  'beauty-health',    'Skincare, makeup and wellness',          4),
  ('Groceries',        'groceries',        'Everyday food and household essentials', 5)
on conflict (slug) do nothing;

-- No products are seeded on purpose: add real ones from the admin panel.

-- ---------------------------------------------------------------------
-- OPTIONAL (manual): create your FIRST ADMIN.
-- 1) Register normally on the site (or Supabase > Authentication > Users).
-- 2) Run this in the SQL editor with YOUR email, then sign in again:
--
--    update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- OPTIONAL (manual): auto-cancel unpaid Paystack orders after 60 minutes
-- so held stock is released. Requires the pg_cron extension
-- (Dashboard > Database > Extensions):
--
--    select cron.schedule('cancel-abandoned-orders', '*/15 * * * *',
--      $$ select public.cancel_abandoned_orders(60); $$);
-- ---------------------------------------------------------------------
