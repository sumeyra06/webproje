-- Enable owner-based RLS for products and customers (idempotent)
-- Adds policies to ensure each user only sees and modifies their own data

-- PRODUCTS
alter table if exists public.products enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_select_own'
  ) then
    create policy products_select_own on public.products for select using (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_insert_own'
  ) then
    create policy products_insert_own on public.products for insert with check (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_update_own'
  ) then
    create policy products_update_own on public.products for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='products' and policyname='products_delete_own'
  ) then
    create policy products_delete_own on public.products for delete using (owner_id = auth.uid());
  end if;
end $$;

-- CUSTOMERS
alter table if exists public.customers enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='customers' and policyname='customers_select_own'
  ) then
    create policy customers_select_own on public.customers for select using (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='customers' and policyname='customers_insert_own'
  ) then
    create policy customers_insert_own on public.customers for insert with check (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='customers' and policyname='customers_update_own'
  ) then
    create policy customers_update_own on public.customers for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='customers' and policyname='customers_delete_own'
  ) then
    create policy customers_delete_own on public.customers for delete using (owner_id = auth.uid());
  end if;
end $$;
