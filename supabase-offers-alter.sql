-- Idempotent migration to align public.offers with frontend expectations
-- Safely adds missing columns; run multiple times without side effects.
--
-- Fields aligned with offers-panel.js payload: name, customer_name, edit_date,
-- due_date, currency, terms, items, subtotal, tax_total, total, owner_id

-- Ensure table exists (keeps any existing data)
create table if not exists public.offers (
  id bigserial primary key,
  created_at timestamptz not null default now()
);

-- Add/align columns
alter table if exists public.offers add column if not exists name text;
alter table if exists public.offers add column if not exists customer_name text;
alter table if exists public.offers add column if not exists customer_id bigint references public.customers(id);
-- Optional fields used by apply.js
alter table if exists public.offers add column if not exists email text;
alter table if exists public.offers add column if not exists phone text;
alter table if exists public.offers add column if not exists status text;
alter table if exists public.offers add column if not exists requested_service text;
alter table if exists public.offers add column if not exists edit_date date;
alter table if exists public.offers add column if not exists due_date date;
alter table if exists public.offers add column if not exists currency text default 'TRY';
alter table if exists public.offers add column if not exists terms text;
alter table if exists public.offers add column if not exists items jsonb default '[]'::jsonb;
alter table if exists public.offers add column if not exists subtotal numeric(18,2) default 0;
alter table if exists public.offers add column if not exists tax_total numeric(18,2) default 0;
alter table if exists public.offers add column if not exists total numeric(18,2) default 0;
alter table if exists public.offers add column if not exists owner_id uuid;

-- Helpful index for multitenancy
create index if not exists idx_offers_owner on public.offers(owner_id);
