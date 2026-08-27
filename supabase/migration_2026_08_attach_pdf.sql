-- Migration: PDF attach storage buckets for invoices and delivery orders
--
-- The DB columns for "is there a PDF attached" already exist from the
-- original schema.sql (`attachment` = storage object key, `attachment_name`
-- = original file name). What is missing is the *storage buckets* and the
-- *policies* that let the app actually upload, open, and delete files.
--
-- This migration is purely additive at the storage layer. It does NOT
-- add any new columns, does NOT change existing column types, and does
-- NOT touch any existing row. Safe to re-run.

-- ────────────────────────────────────────────────────────────────────
-- 1. Storage buckets
-- ────────────────────────────────────────────────────────────────────
-- Supabase storage buckets live in the `storage.buckets` table. We
-- insert them directly (instead of via the Dashboard) so the migration
-- is fully reproducible and any new environment gets the same buckets.
--
-- `public = false` so files aren't reachable via a public URL — the
-- front-end must request a signed URL (createSignedUrl) to view/open.
-- 5 MB cap is a safety net; PDFs from this workflow are typically
-- under 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('invoices-pdf', 'invoices-pdf', false, 5242880,
   array['application/pdf']::text[]),
  ('delivery-orders-pdf', 'delivery-orders-pdf', false, 5242880,
   array['application/pdf']::text[])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ────────────────────────────────────────────────────────────────────
-- 2. RLS policies on storage.objects
-- ────────────────────────────────────────────────────────────────────
-- The app's existing custom auth (app_users + plain-text passwords) does
-- not flow through Supabase Auth, so storage RLS can't check role. The
-- bucket is therefore intentionally permissive at the DB layer; the
-- front-end gates by role (admin-only for write/delete, any logged-in
-- user can read via the signed URL the admin shares).
--
-- Tightening requires either (a) a server-side proxy that signs URLs, or
-- (b) migrating the app to Supabase Auth — both are explicit follow-ups
-- in the README. For this MVP we keep it simple and document the gap.
--
-- These policies are idempotent: drop-if-exists then re-create, so
-- re-running the migration applies any future changes.
drop policy if exists "invoices-pdf read"    on storage.objects;
drop policy if exists "invoices-pdf write"   on storage.objects;
drop policy if exists "invoices-pdf delete"  on storage.objects;
drop policy if exists "delivery-orders-pdf read"    on storage.objects;
drop policy if exists "delivery-orders-pdf write"   on storage.objects;
drop policy if exists "delivery-orders-pdf delete"  on storage.objects;

create policy "invoices-pdf read"    on storage.objects
  for select using (bucket_id = 'invoices-pdf');
create policy "invoices-pdf write"   on storage.objects
  for insert with check (bucket_id = 'invoices-pdf');
create policy "invoices-pdf delete"  on storage.objects
  for delete using (bucket_id = 'invoices-pdf');

create policy "delivery-orders-pdf read"    on storage.objects
  for select using (bucket_id = 'delivery-orders-pdf');
create policy "delivery-orders-pdf write"   on storage.objects
  for insert with check (bucket_id = 'delivery-orders-pdf');
create policy "delivery-orders-pdf delete"  on storage.objects
  for delete using (bucket_id = 'delivery-orders-pdf');

-- ────────────────────────────────────────────────────────────────────
-- Verification (run these by hand to confirm the migration applied):
--   select id, public, file_size_limit, allowed_mime_types
--     from storage.buckets
--     where id in ('invoices-pdf','delivery-orders-pdf');
--   select * from pg_policies
--     where schemaname = 'storage' and tablename = 'objects'
--       and policyname like '%pdf%';
-- ────────────────────────────────────────────────────────────────────
