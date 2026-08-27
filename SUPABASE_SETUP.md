# Connecting to Supabase

The app now reads and writes everything (customers, invoices, delivery
orders, book stock/pricing, user accounts) through a real Supabase Postgres
database instead of in-memory sample data. Follow these steps in order.

## 1. Create a Supabase project

1. Go to https://supabase.com/dashboard and create a new project (any name,
   any region close to you).
2. Wait for it to finish provisioning (a couple of minutes).

## 2. Run the schema

1. In your Supabase project, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
   This creates every table, foreign key, index, and Row Level Security
   policy the app needs.

## 3. Load the starter data

1. Still in the SQL Editor, open a new query.
2. Paste the entire contents of `supabase/seed.sql` and click **Run**.
   This loads all the publications/editions/volumes, sample customers,
   invoices, delivery orders, and login accounts that were previously
   hardcoded into the app — so you start from the same data you had before,
   now actually persisted.

## 4. Get your API credentials

1. In Supabase: **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon public** key (NOT the
   `service_role` key — that one must never go in client-side code).

## 5. Configure the app

1. In the project root, copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in the two values from step 4:
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

## 6. Install and run

```
npm install
npm run dev
```

Sign in with one of the seeded accounts:

| Email | Password | Role |
|---|---|---|
| admin@legalreview.com.my | admin123 | Administrator |
| staff@legalreview.com.my | staff123 | Employee |

The other three seeded accounts (Nadia, Yathwin, Effendy) have the
password `changeme123`.

## Important security note

This app is a browser-only single-page app with no backend server, so
there's nowhere safe to hash/verify passwords or enforce fine-grained
access control server-side. Two consequences worth understanding:

- **Passwords are stored in plain text** in the `app_users` table and
  compared in the browser. Fine for an internal tool on a trusted network;
  not something to expose publicly on the internet with sensitive data.
- **Row Level Security policies are fully permissive** — anyone with the
  anon key (which is visible in the browser bundle, by design for Supabase)
  can read/write every table. This is normal for a Supabase project without
  real backend-enforced auth, but means the anon key is not a secret and
  the database itself provides no access control.

If this ever needs to be internet-facing or handle sensitive data, the
right next step is moving authentication to Supabase Auth (or a real
backend) and rewriting the RLS policies to check `auth.uid()` — that's a
meaningfully bigger change than this migration, so treat it as a separate
project when you're ready for it.

## What changed in the code

- `src/lib/supabaseClient.ts` — the Supabase client, configured from `.env`.
- `src/lib/db.ts` — every read/write the app does against Supabase:
  `loadAllData()` (called once at startup) plus one function per action
  (add customer, delete volume, save invoice, etc.).
- `src/data/sampleData.ts` and `src/data/publicationData.ts` — now just
  type definitions and pure helper functions; the actual records live in
  Supabase and get loaded into these files' exported arrays at startup.
- Every screen that adds/edits/deletes something now calls the matching
  function in `src/lib/db.ts` and awaits it before updating what's on
  screen — so nothing shows as "saved" that didn't actually persist.

Everything else — the invoice/DO print templates, PDF export, book stock
math, customer subscriptions — works exactly as before; it's just reading
from data that now survives a page refresh.
