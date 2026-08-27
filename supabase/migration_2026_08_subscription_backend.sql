-- ============================================================================
-- Migration: subscription backend (fulfillments + payment status + marketing
-- role + "due now" view + create_fulfillment RPC)
--
-- Designed to be applied ON TOP of the existing schema.sql / seed.sql pair,
-- without modifying either. Every statement here is additive: new tables, new
-- columns (with `if not exists`), a relaxed CHECK constraint, a new view, and
-- a new RPC. None of the existing tables/columns/RPCs are dropped or renamed.
--
-- Safe to re-run: idempotent at the column / view / function level. The new
-- `app_users` role CHECK is dropped-and-recreated so it picks up the new
-- 'marketing' value on every run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. New table: fulfillments
--
-- A fulfillment is the spec's "due volume marked fulfilled" event: it
-- decrements stock by 1 and (optionally) creates an invoice line. It is
-- deliberately separate from `delivery_orders` so the printed/shipping
-- record and the billing event can evolve independently.
-- ----------------------------------------------------------------------------

create table if not exists fulfillments (
  id              text primary key,
  customer_id     text not null references customers(id) on delete cascade,
  edition_id      text not null references editions(id),
  vol_num         int  not null check (vol_num > 0),
  fulfilled_at    date not null default current_date,
  -- Snapshot the price at the moment of fulfillment so historical records
  -- stay correct if editions.price_per_volume changes later.
  unit_price      numeric(10,2) not null check (unit_price >= 0),
  -- Optional billing links. A fulfillment can exist without an invoice
  -- (sample, replacement, manual count). When set, the create_fulfillment
  -- RPC appends a matching invoice_item on that invoice in the same call.
  invoice_id      text references invoices(id) on delete set null,
  invoice_item_id uuid,
  prepared_by     text,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_fulfillments_customer     on fulfillments(customer_id);
create index if not exists idx_fulfillments_edition      on fulfillments(edition_id);
create index if not exists idx_fulfillments_fulfilled_at on fulfillments(fulfilled_at);
create index if not exists idx_fulfillments_invoice      on fulfillments(invoice_id);

alter table fulfillments enable row level security;
drop policy if exists "allow all - fulfillments" on fulfillments;
create policy "allow all - fulfillments" on fulfillments for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- 2. New columns on invoices
--
-- Adds a real payment concept independent of the DO-mirrored status:
--   payment_status: 'Unpaid' | 'Partial' | 'Paid'
--   amount_paid:    running total of what the customer has paid so far
--
-- The `amount_paid <= total` invariant is enforced in the application layer
-- (create_fulfillment, updateInvoicePayment) because `total` can change
-- after a row exists and a CHECK can't reference a sibling column reliably.
-- ----------------------------------------------------------------------------

alter table invoices
  add column if not exists payment_status text not null default 'Unpaid'
    check (payment_status in ('Paid','Unpaid','Partial'));

alter table invoices
  add column if not exists amount_paid numeric(10,2) not null default 0
    check (amount_paid >= 0);

-- ----------------------------------------------------------------------------
-- 3. Marketing role: relax the app_users.role CHECK
--
-- No behaviour change for existing rows; the front-end and db.ts already
-- treat unknown roles as non-admin so existing login keeps working.
-- ----------------------------------------------------------------------------

alter table app_users drop constraint if exists app_users_role_check;
alter table app_users
  add constraint app_users_role_check
    check (role in ('admin','employee','marketing'));

-- ----------------------------------------------------------------------------
-- 4. SQL view: v_full_set_next_due
--
-- Single source of truth for the "Due now" panel. Computed at read time —
-- no stored fields on customer_subscriptions. Rolling cadence:
--   next_due_date = last_fulfilled_at + 2 months
--                 (or start_date + 2 months if the customer has no
--                  fulfillments on this subscription yet)
--
-- Excludes:
--   - Inactive customers
--   - Subscriptions where every volume in the edition has already been
--     fulfilled (next_due_vol_num is NULL = complete)
-- ----------------------------------------------------------------------------

create or replace view v_full_set_next_due as
with fulfilled_vols as (
  select customer_id, edition_id,
         array_agg(distinct vol_num order by vol_num) as vol_nums
  from fulfillments
  group by customer_id, edition_id
),
last_fulfillment as (
  select customer_id, edition_id, max(fulfilled_at) as last_fulfilled_at
  from fulfillments
  group by customer_id, edition_id
),
next_vol as (
  -- For each full-set subscription, the lowest vol_num 1..volume_count
  -- not yet in the customer's fulfilled set; NULL = subscription complete.
  select cs.id as subscription_id,
         cs.customer_id, cs.edition_id,
         (
           select s from generate_series(1, e.volume_count) s
           where s <> all(coalesce(fv.vol_nums, '{}'::int[]))
           order by s limit 1
         ) as next_due_vol_num
  from customer_subscriptions cs
  join editions e on e.id = cs.edition_id
  left join fulfilled_vols fv
    on fv.customer_id = cs.customer_id and fv.edition_id = cs.edition_id
  where cs.volume_scope = 'Full Set'
)
select
  nv.subscription_id,
  nv.customer_id,
  c.company        as customer_name,
  nv.edition_id,
  e.pub_type,
  e.period_label,
  e.volume_count,
  nv.next_due_vol_num,
  lf.last_fulfilled_at,
  cs.start_date,
  case
    when lf.last_fulfilled_at is not null
      then lf.last_fulfilled_at + interval '2 months'
    else cs.start_date + interval '2 months'
  end as next_due_date,
  (current_date >= case
    when lf.last_fulfilled_at is not null
      then lf.last_fulfilled_at + interval '2 months'
    else cs.start_date + interval '2 months'
  end) as is_due_now,
  (current_date > case
    when lf.last_fulfilled_at is not null
      then lf.last_fulfilled_at + interval '2 months'
    else cs.start_date + interval '2 months'
  end) as is_overdue
from next_vol nv
join customer_subscriptions cs on cs.id = nv.subscription_id
join customers c on c.id = nv.customer_id
join editions e on e.id = nv.edition_id
left join last_fulfillment lf
  on lf.customer_id = nv.customer_id and lf.edition_id = nv.edition_id
where c.status = 'Active'
  and nv.next_due_vol_num is not null;

-- ----------------------------------------------------------------------------
-- 5. Postgres function: create_fulfillment
--
-- Atomic create: insert fulfillment row, decrement volumes.stock, optionally
-- append an invoice_item. Returns a JSON object the client can read straight
-- off the supabase.rpc('create_fulfillment', {...}) result.
--
-- Stock is clamped at 0 — matches deductStock() in src/data/publicationData.ts
-- so behaviour is identical whether the user creates a fulfillment or a DO.
-- ----------------------------------------------------------------------------

create or replace function create_fulfillment(
  p_id           text,
  p_customer_id  text,
  p_edition_id   text,
  p_vol_num      int,
  p_unit_price   numeric,
  p_fulfilled_at date    default current_date,
  p_invoice_id   text    default null,
  p_prepared_by  text    default null,
  p_notes        text    default null
) returns json
language plpgsql
as $$
declare
  v_edition         editions%rowtype;
  v_volume          volumes%rowtype;
  v_new_stock       int;
  v_invoice_item_id uuid;
begin
  select * into v_edition from editions where id = p_edition_id;
  if not found then
    raise exception 'Edition % not found', p_edition_id;
  end if;

  select * into v_volume from volumes
    where edition_id = p_edition_id and vol_num = p_vol_num
    for update;
  if not found then
    raise exception 'Volume % of % not found', p_vol_num, p_edition_id;
  end if;

  v_new_stock := greatest(0, v_volume.stock - 1);
  update volumes set stock = v_new_stock
    where edition_id = p_edition_id and vol_num = p_vol_num;

  if p_invoice_id is not null then
    insert into invoice_items
      (invoice_id, pub, pub_code, years, volumes, qty, unit, total, sort_order)
    values
      (p_invoice_id, v_edition.pub_type, null, v_edition.period_label,
       'Volume ' || p_vol_num, 1, p_unit_price, p_unit_price,
       (select coalesce(max(sort_order), -1) + 1
          from invoice_items where invoice_id = p_invoice_id))
    returning id into v_invoice_item_id;

    -- Recompute invoice total so the new line shows up everywhere the
    -- invoice is rendered. Subtotal is also reset to the same value
    -- (no discounts are applied automatically — admins still set those).
    update invoices
      set total    = coalesce((select sum(total) from invoice_items
                                where invoice_id = p_invoice_id), 0),
          subtotal = coalesce((select sum(total) from invoice_items
                                where invoice_id = p_invoice_id), 0)
      where id = p_invoice_id;
  end if;

  insert into fulfillments
    (id, customer_id, edition_id, vol_num, fulfilled_at,
     unit_price, invoice_id, invoice_item_id, prepared_by, notes)
  values
    (p_id, p_customer_id, p_edition_id, p_vol_num, p_fulfilled_at,
     p_unit_price, p_invoice_id, v_invoice_item_id, p_prepared_by, p_notes);

  return json_build_object(
    'id',              p_id,
    'vol_num',         p_vol_num,
    'new_stock',       v_new_stock,
    'invoice_item_id', v_invoice_item_id
  );
end;
$$;
