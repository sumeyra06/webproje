-- Çoklu müşteri (tenant) için owner_id sütunları ve indeksleri
-- Not: Supabase tarafında RLS ile owner_id üzerinden izolasyon sağlanmalıdır.

create extension if not exists "pgcrypto";

-- 1) Common: Add owner_id uuid to main tables
alter table if exists public.products add column if not exists owner_id uuid;
alter table if exists public.customers add column if not exists owner_id uuid;
alter table if exists public.invoices add column if not exists owner_id uuid;
alter table if exists public.offers add column if not exists owner_id uuid;
alter table if exists public.warehouses add column if not exists owner_id uuid;
alter table if exists public.media add column if not exists owner_id uuid;

-- 2) Indexes for fast filtering
create index if not exists idx_products_owner on public.products(owner_id);
create index if not exists idx_customers_owner on public.customers(owner_id);
create index if not exists idx_invoices_owner on public.invoices(owner_id);
create index if not exists idx_offers_owner on public.offers(owner_id);
create index if not exists idx_warehouses_owner on public.warehouses(owner_id);
create index if not exists idx_media_owner on public.media(owner_id);

-- 3) Optional: default owner_id via JWT (if using Supabase Auth)
-- alter table public.invoices alter column owner_id set default (auth.uid());
-- ... apply similar for other tables if desired.

-- 4) RLS policy templates (adjust for each table)
-- Sample for invoices:
-- alter table public.invoices enable row level security;
-- create policy if not exists inv_select on public.invoices for select using (owner_id = auth.uid());
-- create policy if not exists inv_ins on public.invoices for insert with check (owner_id = auth.uid());
-- create policy if not exists inv_upd on public.invoices for update using (owner_id = auth.uid());
-- create policy if not exists inv_del on public.invoices for delete using (owner_id = auth.uid());

