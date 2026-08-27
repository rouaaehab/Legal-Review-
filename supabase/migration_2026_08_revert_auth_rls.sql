-- ============================================================================
-- The Legal Review — Revert auth-migration RLS + drop auth_user_id
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run.
-- Idempotent (every statement uses IF EXISTS / drop-and-recreate where it
-- matters), safe to re-run.
--
-- Why this file exists:
-- At some point during development the supabase/migration_2026_08_auth.sql
-- migration (the Supabase Auth migration, since reverted) was applied to
-- this database. It:
--   - added the now-empty app_users.auth_user_id column
--   - replaced every permissive "allow all - <table>" RLS policy with
--     strict "read - <table>" / "write - <table>" policies that gate
--     reads on is_active_staff() and writes on is_admin()
--   - replaced the permissive storage policies on the invoices-pdf and
--     delivery-orders-pdf buckets with admin-write / staff-read policies
--   - created the is_active_staff() and is_admin() helper functions
-- Since the cutover was never run, no app_users row has an auth_user_id
-- populated, so is_active_staff() returns false for the anon key, every
-- read against the business tables returns 0 rows, and verifyLogin sees
-- data: null → "Invalid email or password" for every credential. This
-- migration is the pure revert: it puts the database back to the state
-- schema.sql describes (fully permissive RLS, no auth_user_id column) so
-- the original custom-app_users auth model in src/lib/db.ts works again.
--
-- What it does NOT do:
--   - does not change the front-end (which is already on the original
--     verifyLogin path)
--   - does not change any existing data — all app_users rows, passwords,
--     and the password column itself are preserved
--   - does not touch auth.users (no rows were ever created there; the
--     cutover never ran)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Business-table RLS: drop the strict policies, recreate the permissive
--    "allow all - <table>" policies that schema.sql defines.
-- ----------------------------------------------------------------------------

-- app_users: the auth migration added two policies
drop policy if exists "read own row - app_users"       on app_users;
drop policy if exists "admin write - app_users"        on app_users;
drop policy if exists "allow all - app_users"           on app_users;
create policy "allow all - app_users" on app_users
  for all using (true) with check (true);

-- The other 9 business tables: each had one "read - <table>" + one "write - <table>"
-- policy from the auth migration, plus the original "allow all - <table>".
-- Drop the strict pair, then recreate the original permissive one.
do $$
declare
  t text;
  tables text[] := array[
    'customer_subscriptions',
    'customers',
    'delivery_order_items',
    'delivery_orders',
    'editions',
    'fulfillments',
    'invoice_items',
    'invoices',
    'volumes'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on %I',  'read - '  || t, t);
    execute format('drop policy if exists %I on %I',  'write - ' || t, t);
    execute format('drop policy if exists %I on %I',  'allow all - ' || t, t);
    execute format(
      'create policy %I on %I for all using (true) with check (true)',
      'allow all - ' || t, t
    );
  end loop;
end$$;

-- ----------------------------------------------------------------------------
-- 2. Drop app_users.auth_user_id. CASCADE drops the unique constraint and
--    index that the column carried, so we don't have to know their exact
--    auto-generated names. The FK to auth.users goes with the column.
-- ----------------------------------------------------------------------------

alter table app_users drop column if exists auth_user_id cascade;
drop index if exists idx_app_users_auth_user;

-- ----------------------------------------------------------------------------
-- 3. Storage: drop the 4 strict policies the auth migration added. The 6
--    original bucket policies (read / write / delete on each bucket) are
--    untouched — they don't reference the helper functions, so they keep
--    working once those functions are gone. This must run BEFORE the
--    function drops in section 4, since `staff read` policies depend on
--    is_active_staff().
-- ----------------------------------------------------------------------------

drop policy if exists "admin write delivery-orders-pdf" on storage.objects;
drop policy if exists "admin write invoices-pdf"        on storage.objects;
drop policy if exists "staff read delivery-orders-pdf"  on storage.objects;
drop policy if exists "staff read invoices-pdf"         on storage.objects;

-- ----------------------------------------------------------------------------
-- 4. Drop the auth helper functions. IF EXISTS keeps this idempotent if a
--    function was never created (e.g. on a database that had the column
--    added but not the rest of the migration).
-- ----------------------------------------------------------------------------

drop function if exists is_active_staff();
drop function if exists is_admin();
drop function if exists bootstrap_auth_user(text, text, text, text);
drop function if exists revoke_auth_user(uuid);
