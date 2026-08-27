-- ============================================================================
-- The Legal Review — Supabase schema
-- Run this once in Supabase Dashboard → SQL Editor → New Query → Run.
-- Safe to re-run: every statement uses IF NOT EXISTS / drop-and-recreate
-- where sensible, but running it twice on a database that already has data
-- will fail on the primary-key constraints — that's expected; it's meant to
-- be run once against a fresh project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Book Management: publications, editions (one row per publication+year+
-- category, e.g. "MLRA 2023 Annual"), and volumes (one row per physical
-- volume within an edition, carrying its own stock count).
-- ----------------------------------------------------------------------------

create table editions (
  id                 text primary key,   -- e.g. 'MLRA-2023', 'MLRA-SC-2000', 'MLRA-CI-2012-2023'
  pub_type           text not null check (pub_type in ('MLRA','MLRH','MELR','TCLR','SSLR')),
  category           text not null check (category in ('Annual','Selected Cases','Consolidated Index')),
  year               int not null,
  period_label       text not null,
  volume_count       int not null check (volume_count > 0),
  full_set_price     numeric(10,2) not null,
  price_per_volume   numeric(10,2) not null,
  is_active          boolean not null default true,
  is_auto_generated  boolean not null default false,
  notes              text,
  created_at         timestamptz not null default now()
);

create table volumes (
  id          uuid primary key default gen_random_uuid(),
  edition_id  text not null references editions(id) on delete cascade,
  vol_num     int not null,
  label       text not null,
  stock       int not null default 0 check (stock >= 0),
  created_at  timestamptz not null default now(),
  unique (edition_id, vol_num)
);

create index idx_editions_pub_period on editions (pub_type, period_label);
create index idx_volumes_edition on volumes (edition_id);

-- ----------------------------------------------------------------------------
-- Customers and their subscriptions (a subscription ties a customer to one
-- specific edition — a Full Set drip-fed over time, or a single volume).
-- ----------------------------------------------------------------------------

create table customers (
  id          text primary key,
  invoice_no  text not null,
  company     text not null,
  pic         text,
  contact     text,
  tin         text,
  brn         text,
  period      text,
  status      text not null default 'Active' check (status in ('Active','Complete')),
  address     text,
  tel         text,
  created_at  timestamptz not null default now()
);

create table customer_subscriptions (
  id            text primary key,
  customer_id   text not null references customers(id) on delete cascade,
  edition_id    text not null references editions(id),
  volume_scope  text not null,   -- 'Full Set' or 'Volume N'
  start_date    date,
  created_at    timestamptz not null default now()
);

create index idx_subscriptions_customer on customer_subscriptions (customer_id);

-- ----------------------------------------------------------------------------
-- Invoices and delivery orders. They reference each other (an invoice can
-- have a linked delivery order and vice versa) — both FKs are added after
-- both tables exist, and both SET NULL on delete so removing one side never
-- cascades into deleting the other.
-- ----------------------------------------------------------------------------

create table invoices (
  id             text primary key,
  invoice_no     text not null,
  date           date not null,
  customer_id    text references customers(id) on delete set null,
  customer_name  text not null,   -- snapshot at time of invoice
  address        text,
  attention      text,
  subtotal       numeric(10,2) not null default 0,
  discount       numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  bank           text,
  account        text,
  account_name   text,
  branch         text,
  status         text not null default 'Pending',   -- fallback only; display status mirrors the linked DO's status
  do_id          text,
  prepared_by    text,
  attachment       text,
  attachment_name  text,
  created_at     timestamptz not null default now()
);

create table invoice_items (
  id           uuid primary key default gen_random_uuid(),
  invoice_id   text not null references invoices(id) on delete cascade,
  pub          text not null,
  pub_code     text,
  years        text not null,
  volumes      text not null,
  qty          int not null check (qty > 0),
  unit         numeric(10,2) not null,
  total        numeric(10,2) not null,
  sort_order   int not null default 0
);

create table delivery_orders (
  id             text primary key,
  do_no          text not null,
  tracking_no    text,
  date           date not null,
  customer_id    text references customers(id) on delete set null,
  customer_name  text not null,
  pic            text,
  address        text,
  contact        text,
  publication    text,   -- plain-text summary, used by list views
  year           text,
  volume         text,
  qty            int not null default 1,
  status         text not null default 'Pending' check (status in ('Pending','Processing','Delivered','Cancelled')),
  invoice_id     text,
  prepared_by    text,
  attachment       text,
  attachment_name  text,
  -- When true, creating this DO records the shipment but does NOT call
  -- deductStockAndPersist — the volume's stock in Book Management is left
  -- untouched. Set by the admin via the "Skip stock deduction" checkbox on
  -- Create Delivery Order; immutable after creation.
  skip_stock_deduction boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Safe migration for existing DBs that already ran the original schema.
-- ADD COLUMN IF NOT EXISTS is idempotent: fresh DBs hit the column in the
-- CREATE TABLE above, existing DBs get the column added here.
alter table delivery_orders
  add column if not exists skip_stock_deduction boolean not null default false;

create table delivery_order_items (
  id                  uuid primary key default gen_random_uuid(),
  delivery_order_id   text not null references delivery_orders(id) on delete cascade,
  pub                 text not null,
  pub_code            text,
  years               text not null,
  volumes             text not null,
  qty                 int not null check (qty > 0),
  sort_order          int not null default 0
);

alter table invoices
  add constraint invoices_do_id_fkey foreign key (do_id) references delivery_orders(id) on delete set null;
alter table delivery_orders
  add constraint delivery_orders_invoice_id_fkey foreign key (invoice_id) references invoices(id) on delete set null;

create index idx_invoices_customer on invoices (customer_id);
create index idx_invoices_do on invoices (do_id);
create index idx_invoice_items_invoice on invoice_items (invoice_id);
create index idx_do_customer on delivery_orders (customer_id);
create index idx_do_invoice on delivery_orders (invoice_id);
create index idx_do_items_do on delivery_order_items (delivery_order_id);

-- ----------------------------------------------------------------------------
-- App users (login + User Management screen).
--
-- IMPORTANT SECURITY CAVEAT: this app is a browser-only SPA with no backend
-- server, so there is nowhere safe to hash/verify passwords server-side.
-- Passwords are stored in plain text here and compared in the browser. That
-- is fine for an internal tool behind a trusted network / limited rollout,
-- but is NOT suitable for anything internet-facing with sensitive data. The
-- real fix later is Supabase Auth (or any real backend) — ask me when
-- you're ready to move to that; it's a bigger change than this migration.
-- ----------------------------------------------------------------------------

create table app_users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  password    text not null,
  role        text not null default 'employee' check (role in ('admin','employee')),
  status      text not null default 'Active' check (status in ('Active','Inactive')),
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Row Level Security. Enabled on every table, with a single permissive
-- policy allowing the app's anon key to do everything — because, again,
-- there's no backend/session to scope access by. This is here so RLS is at
-- least ON (Supabase flags public tables with RLS off), and so tightening
-- it later (once there's real auth) is a policy change, not a rewrite.
-- ----------------------------------------------------------------------------

alter table editions enable row level security;
alter table volumes enable row level security;
alter table customers enable row level security;
alter table customer_subscriptions enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table delivery_orders enable row level security;
alter table delivery_order_items enable row level security;
alter table app_users enable row level security;

create policy "allow all - editions" on editions for all using (true) with check (true);
create policy "allow all - volumes" on volumes for all using (true) with check (true);
create policy "allow all - customers" on customers for all using (true) with check (true);
create policy "allow all - customer_subscriptions" on customer_subscriptions for all using (true) with check (true);
create policy "allow all - invoices" on invoices for all using (true) with check (true);
create policy "allow all - invoice_items" on invoice_items for all using (true) with check (true);
create policy "allow all - delivery_orders" on delivery_orders for all using (true) with check (true);
create policy "allow all - delivery_order_items" on delivery_order_items for all using (true) with check (true);
create policy "allow all - app_users" on app_users for all using (true) with check (true);
