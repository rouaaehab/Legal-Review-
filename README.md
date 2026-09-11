# The Legal Review — Book Management System
 
Internal admin/marketing platform for **The Legal Review Sdn Bhd**. Manages
book stock (editions, volumes, pricing), customers and subscriptions,
invoices and delivery orders (with print/PDF output), and reporting —
backed by a live Supabase database with real-time sync across sessions.
 
## Tech stack
 
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4
- **Database / Auth / Realtime:** Supabase (PostgreSQL, Storage, Realtime)
- **Testing:** Vitest
- **Exports:** ExcelJS (`.xlsx`), browser print → PDF
## Project structure
 
```
.
├── src/
│   ├── components/   # Screens (Dashboard, Invoices, Book Management, …)
│   ├── data/          # Types, constants, and pure helper functions
│   ├── lib/            # Supabase client, all DB reads/writes, exports
│   └── App.tsx         # Routing, auth state, realtime subscription
├── supabase/
│   ├── schema.sql       # Tables, indexes, RLS policies
│   ├── seed.sql          # Starter data (editions, customers, logins)
│   └── migration_*.sql    # Incremental schema changes, in date order
├── tests/                  # Vitest unit tests (pure logic, no DOM)
└── SUPABASE_SETUP.md         # Full step-by-step Supabase setup guide
```
 
## Setup
 
### 1. Supabase
 
1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. In the SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`
   (creates every table/RLS policy, then loads starter editions, customers,
   and login accounts).
3. Run any `supabase/migration_*.sql` files in date order if starting from
   an older schema snapshot.
4. In **Project Settings → API**, copy the **Project URL** and the
   **anon public** key (not the `service_role` key).
See [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) for the full walkthrough,
including seeded login credentials and a security note on this app's
auth model.
 
### 2. Configure the app
 
Create a `.env` file in the project root:
 
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
 
### 3. Install and run
 
```
npm install
npm run dev
```
 
App runs at `http://localhost:5173`.
 
### 4. Enable Realtime (optional but recommended)
 
For price/stock edits in Book Management to sync automatically across
open tabs, enable Realtime replication in **Supabase → Database →
Publications → supabase_realtime** for: `pub_types`, `editions`,
`volumes`, `customers`, `invoices`, `delivery_order_items`.
 
## Deploy
 
Deployed on [Vercel](https://vercel.com), connected to this repo's `main`
branch for automatic deploys on push.
 
1. Push the repo to GitHub and import it in Vercel.
2. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`.
3. Set environment variables in the Vercel project settings:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Redeploy after setting env vars.
## Scripts
 
| Location | Command | Description |
|---|---|---|
| repo root | `npm run dev` | Start the Vite dev server |
| repo root | `npm run build` | Production build (outputs to `dist/`) |
| repo root | `npm run preview` | Preview the production build locally |
| repo root | `npm test` | Run the Vitest test suite once |
| repo root | `npm run test:watch` | Run tests in watch mode |
| repo root | `npm run format` | Format source with oxfmt |
 
## Features
 
**Book Management** — Publication types, yearly editions, per-volume
stock, and full-set/per-volume pricing; admins can add new publication
types and editions from the UI. Yearly Annual editions for recurring
titles are auto-generated on load.
 
**Customers** — Customer records with contact/billing info and
subscriptions (publication + volume scope + start date), used to track
recurring deliveries.
 
**Invoices & Delivery Orders** — Create/edit either independently or
together (creating an invoice can auto-generate its linked delivery
order). Printable A4 documents with company letterhead, bank details,
and PDF attachment upload/download via Supabase Storage. Multi-year line
items for the same publication are grouped into a single printed row.
 
**Reports** — Monthly sales and revenue trends, low-stock alerts, and
subscription overviews.
 
**Realtime sync** — Book Management edits (prices, stock, editions,
publication types) and invoice/customer/delivery-order changes propagate
live to every open tab/session via Supabase Realtime, without a manual
refresh.
 
**Roles** — `admin` (full read/write),
and `marketing` (read-only) — enforced in the UI via role checks.
 
**Excel export** — Reports and lists export to `.xlsx` via ExcelJS.
 
## Testing
 
```
npm test
```
 
Tests are pure-logic unit tests (payment status, fulfillment, monthly
sales, due-now view, realtime data refresh, export) run against in-memory
fixtures — no browser or Supabase connection required.
 






