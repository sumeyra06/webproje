-- Legacy invoices table create script (idempotent)
-- Run this in Supabase SQL editor as a Postgres role (or role with DDL privileges).
-- WARNING: Run only after you have a DB backup if this is production.

-- Create invoices table if not exists
create table if not exists public.invoices (
  id bigserial primary key,
  owner_id uuid,
  name text,
  customer_id bigint,
  customer_name text,
  invoice_no text,
  category text,
  tags text[] default '{}',
  stock_tracking_mode text check (stock_tracking_mode in ('out','noout')) default 'out',
  edit_date date,
  due_date date,
  currency text default 'TRY',
  collection_status text,
  items jsonb default '[]'::jsonb,
  subtotal numeric(18,4) default 0,
  tax_total numeric(18,4) default 0,
  total numeric(18,4) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Ensure columns exist (idempotent for older schemas)
alter table if exists public.invoices
  add column if not exists owner_id uuid;
alter table if exists public.invoices
  add column if not exists items jsonb default '[]'::jsonb;
alter table if exists public.invoices
  add column if not exists subtotal numeric(18,4) default 0;
alter table if exists public.invoices
  add column if not exists tax_total numeric(18,4) default 0;
alter table if exists public.invoices
  add column if not exists total numeric(18,4) default 0;

-- Indexes
create index if not exists idx_invoices_owner on public.invoices(owner_id);
create index if not exists idx_invoices_invoice_no on public.invoices(invoice_no);
create index if not exists idx_invoices_edit_date on public.invoices(edit_date);
create index if not exists idx_invoices_tags on public.invoices using gin (tags);

-- set_updated_at trigger function (create or replace)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger
do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_invoices_set_updated_at'
  ) then
    create trigger trg_invoices_set_updated_at
    before update on public.invoices
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Enable RLS and add conservative owner-only policies (optional)
alter table public.invoices enable row level security;

-- Only create policies if not already present
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_select_own') then
    create policy invoices_select_own on public.invoices
      for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_ins_own') then
    create policy invoices_ins_own on public.invoices
      for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_upd_own') then
    create policy invoices_upd_own on public.invoices
      for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices' and policyname = 'invoices_del_own') then
    create policy invoices_del_own on public.invoices
      for delete using (owner_id = auth.uid());
  end if;
end $$;

-- Small sample insert (uncomment to test) - change owner_id to your auth user id if testing
-- insert into public.invoices (owner_id, name, invoice_no, customer_name, items, subtotal, tax_total, total)
-- values ('00000000-0000-0000-0000-000000000000', 'Test Fatura', 'INV-TEST-001', 'Test Müşteri', '[{"desc":"Ürün A","qty":2,"unit":"Adet","price":10,"tax":18}]'::jsonb, 20, 3.6, 23.6);

-- End of script
