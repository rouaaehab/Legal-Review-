-- ============================================================================
-- The Legal Review — Server-side change password
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run.
-- Idempotent (uses CREATE OR REPLACE), safe to re-run.
--
-- What it adds: a single SQL function `change_app_user_password(p_email,
-- p_current, p_new)` that the Settings → Account → Change Password form
-- calls via `supabase.rpc('change_app_user_password', ...)`. It validates
-- the current password matches the row, validates the new password's
-- length, then UPDATEs the row. On any failure it raises an exception
-- the front-end surfaces as a red error banner.
--
-- Why a function and not a direct UPDATE from the front-end: a direct
-- UPDATE would let anyone with the anon key (and a user's email) overwrite
-- any password without knowing the current one. The function enforces
-- "must know the current password" server-side, which the front-end
-- alone can't guarantee.
--
-- This is purely additive: it does not change any existing table, view,
-- function, or RLS policy. The `app_users.password` column is unchanged
-- (still plaintext — see SECURITY CAVEAT in schema.sql).
-- ============================================================================

create or replace function change_app_user_password(
  p_email    text,
  p_current  text,
  p_new      text
) returns void
language plpgsql
as $$
declare
  v_row app_users%rowtype;
begin
  -- Trim inputs and reject obvious garbage up front so the front-end
  -- gets a clear error instead of a silent success.
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required';
  end if;
  if p_current is null or length(p_current) = 0 then
    raise exception 'Current password is required';
  end if;
  if p_new is null or length(p_new) < 8 then
    raise exception 'New password must be at least 8 characters';
  end if;
  if p_new = p_current then
    raise exception 'New password must be different from the current one';
  end if;

  -- Lock the row for update so two concurrent password changes don't
  -- both succeed (the second one would still see the original password
  -- before the first one committed). SELECT ... FOR UPDATE.
  select * into v_row
    from app_users
    where email = p_email
    for update;
  if not found then
    raise exception 'Account not found';
  end if;
  if v_row.status <> 'Active' then
    raise exception 'Account is inactive';
  end if;
  if v_row.password <> p_current then
    raise exception 'Current password is incorrect';
  end if;

  update app_users
    set password = p_new
    where id = v_row.id;
end;
$$;
