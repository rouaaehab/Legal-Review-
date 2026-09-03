-- ============================================================================
-- Book Management — admin-driven publication types
--
-- Adds the small `pub_types` registry that holds the display label for each
-- publication type code. Previously the 5 pub types were hardcoded in two
-- places (editions.pub_type CHECK + the front-end's PUB_LABELS); this
-- migration relaxes the DB-side check and moves the label storage into a
-- registry so an admin can add a brand-new publication type from the UI
-- without a code change.
--
-- The front-end still ships with the 5 originals (MLRA, MLRH, MELR, TCLR,
-- SSLR) so the registry is pre-populated; an explicit seed ensures that
-- holds true even on databases that already have edition rows from before
-- the registry existed.
--
-- Safe to re-run: every statement uses IF NOT EXISTS / drop-if-exists /
-- ON CONFLICT DO NOTHING.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Pub-type registry. One row per publication code. Holds the display
--    label used by every screen in the front-end (Book Management, Create
--    Invoice / DO, Reports, Dashboard, etc.). No FKs point at this table —
--    it's purely a label/identity store; editions still carry `pub_type`
--    as plain text and the app-side code is the single source of truth
--    for the allowlist.
-- ----------------------------------------------------------------------------

create table if not exists pub_types (
  code  text primary key,   -- e.g. 'MLRA', or 'JLR' for a brand-new type
  label text not null       -- human-readable display name
);

-- Pre-populate the 5 originals so existing data + existing screens keep
-- showing the same labels they always did. `on conflict do nothing` makes
-- this safe on databases that already ran this migration once.
insert into pub_types (code, label) values
  ('MLRA', 'Malaysian Law Review (Appellate Court)'),
  ('MLRH', 'Malaysian Law Review (High Court)'),
  ('MELR', 'Malaysian Employment Law Reports'),
  ('TCLR', 'The Commonwealth Law Review'),
  ('SSLR', 'Sabah Sarawak Law Review')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 2) Relax the editions.pub_type CHECK so admins can introduce a new
--    publication type from the UI. The front-end (src/lib/db.ts) now
--    enforces the allowlist itself when writing rows; the DB column
--    becomes free-form text. Existing rows keep their values.
-- ----------------------------------------------------------------------------

alter table editions drop constraint if exists editions_pub_type_check;

-- ----------------------------------------------------------------------------
-- 3) RLS, matching the style of every other table in schema.sql.
-- ----------------------------------------------------------------------------

alter table pub_types enable row level security;

drop policy if exists "allow all - pub_types" on pub_types;
create policy "allow all - pub_types" on pub_types
  for all using (true) with check (true);
