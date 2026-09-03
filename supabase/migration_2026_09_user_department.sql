-- ===================================================================
-- Add a nullable `department` column to `app_users` for the
-- User Profile feature in Settings (see Book Management / Settings
-- user story). Additive, idempotent, no constraints.
--
-- Why this is needed:
--   Settings → User Profile lets the user edit their Name, Email,
--   and Department. Name and Email already exist on app_users;
--   Department is new. The column is nullable so every existing
--   row stays valid without a backfill — users who never set one
--   simply show empty in Admin → User Management.
--
-- No CHECK constraint: department is a free-text label the admin
-- may want to evolve (rename departments, merge them, etc.) and
-- not something the DB needs to police.
--
-- Run once in Supabase Dashboard → SQL Editor → New Query.
-- ===================================================================

alter table app_users add column if not exists department text;
