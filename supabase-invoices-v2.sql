-- Invoices v2 normalized schema (idempotent)
-- Tables: invoices_v2, invoice_items_v2
-- RLS: owner_id = auth.uid()

create table if not exists public.invoices_v2 (
  id bigserial primary key,
  owner_id uuid not null,
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
  collection_status text check (collection_status in ('pending','collected')) default 'pending',
  subtotal numeric(18,4) default 0,
  tax_total numeric(18,4) default 0,
  total numeric(18,4) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.invoice_items_v2 (
  id bigserial primary key,
  owner_id uuid not null,
  invoice_id bigint not null references public.invoices_v2(id) on delete cascade,
  product_id bigint,
  description text,
  unit text,
  qty numeric(18,4) not null default 0,
  unit_price numeric(18,4) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  line_subtotal numeric(18,4) not null default 0,  -- qty * unit_price
  line_tax numeric(18,4) not null default 0,       -- line_subtotal * (tax_rate/100)
  line_total numeric(18,4) not null default 0,     -- line_subtotal + line_tax
  sort_order int default 0
);

-- Indexes
create index if not exists invoices_v2_owner_idx on public.invoices_v2(owner_id);
create index if not exists invoice_items_v2_owner_idx on public.invoice_items_v2(owner_id);
create index if not exists invoice_items_v2_invoice_idx on public.invoice_items_v2(invoice_id);

-- Trigger to keep updated_at current
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_invoices_v2_set_updated_at'
  ) then
    create trigger trg_invoices_v2_set_updated_at
    before update on public.invoices_v2
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Ensure 'name' column exists if table created earlier without it
alter table if exists public.invoices_v2
  add column if not exists name text;

-- RLS
alter table public.invoices_v2 enable row level security;
alter table public.invoice_items_v2 enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices_v2' and policyname = 'invoices_v2_select_own') then
    create policy invoices_v2_select_own on public.invoices_v2
      for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices_v2' and policyname = 'invoices_v2_ins_own') then
    create policy invoices_v2_ins_own on public.invoices_v2
      for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices_v2' and policyname = 'invoices_v2_upd_own') then
    create policy invoices_v2_upd_own on public.invoices_v2
      for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoices_v2' and policyname = 'invoices_v2_del_own') then
    create policy invoices_v2_del_own on public.invoices_v2
      for delete using (owner_id = auth.uid());
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_items_v2' and policyname = 'invoice_items_v2_select_own') then
    create policy invoice_items_v2_select_own on public.invoice_items_v2
      for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_items_v2' and policyname = 'invoice_items_v2_ins_own') then
    create policy invoice_items_v2_ins_own on public.invoice_items_v2
      for insert with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_items_v2' and policyname = 'invoice_items_v2_upd_own') then
    create policy invoice_items_v2_upd_own on public.invoice_items_v2
      for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invoice_items_v2' and policyname = 'invoice_items_v2_del_own') then
    create policy invoice_items_v2_del_own on public.invoice_items_v2
      for delete using (owner_id = auth.uid());
  end if;
end $$;

-- Optional: Best-effort migration helper (copy from old invoices/items json)
-- Run manually after reviewing data:
-- insert into public.invoices_v2 (...)
-- select ... from public.invoices i where i.owner_id = auth.uid();
-- and insert into public.invoice_items_v2 by expanding jsonb_array_elements(i.items)
