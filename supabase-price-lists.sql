-- Fiyat Listeleri şeması (idempotent)
create table if not exists public.price_lists (
  id bigserial primary key,
  name text not null,
  status text not null default 'active', -- active | inactive
  description text,
  owner_id uuid, -- çoklu kiracılık
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_list_items (
  id bigserial primary key,
  price_list_id bigint not null references public.price_lists(id) on delete cascade,
  product_id bigint,
  product_name text not null,
  price numeric(18,2) not null default 0,
  currency text not null default 'TRY',
  discount numeric(5,2) not null default 0
);

-- updated_at tetikleyicisi
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tg_price_lists_updated on public.price_lists;
create trigger tg_price_lists_updated
before update on public.price_lists
for each row execute function public.set_updated_at();

-- Basit RLS (opsiyonel: owner_id ile kapsam)
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;

-- Kısıtlı seçme politikası (owner_id tabanlı)
drop policy if exists price_lists_select on public.price_lists;
create policy price_lists_select on public.price_lists
for select using (coalesce(owner_id, auth.uid()) = auth.uid());
drop policy if exists price_list_items_select on public.price_list_items;
create policy price_list_items_select on public.price_list_items
for select using (exists (
  select 1 from public.price_lists pl
  where pl.id = price_list_items.price_list_id
    and coalesce(pl.owner_id, auth.uid()) = auth.uid()
));

-- Ekleme/güncelleme/silme: sadece kendi kayıtları
drop policy if exists price_lists_ins on public.price_lists;
create policy price_lists_ins on public.price_lists
for insert with check (coalesce(owner_id, auth.uid()) = auth.uid());
drop policy if exists price_lists_upd on public.price_lists;
create policy price_lists_upd on public.price_lists
for update using (coalesce(owner_id, auth.uid()) = auth.uid()) with check (coalesce(owner_id, auth.uid()) = auth.uid());
drop policy if exists price_lists_del on public.price_lists;
create policy price_lists_del on public.price_lists
for delete using (coalesce(owner_id, auth.uid()) = auth.uid());

drop policy if exists price_list_items_ins on public.price_list_items;
create policy price_list_items_ins on public.price_list_items
for insert with check (exists (
  select 1 from public.price_lists pl
  where pl.id = price_list_items.price_list_id
    and coalesce(pl.owner_id, auth.uid()) = auth.uid()
));
drop policy if exists price_list_items_upd on public.price_list_items;
create policy price_list_items_upd on public.price_list_items
for update using (exists (
  select 1 from public.price_lists pl
  where pl.id = price_list_items.price_list_id
    and coalesce(pl.owner_id, auth.uid()) = auth.uid()
)) with check (exists (
  select 1 from public.price_lists pl
  where pl.id = price_list_items.price_list_id
    and coalesce(pl.owner_id, auth.uid()) = auth.uid()
));
drop policy if exists price_list_items_del on public.price_list_items;
create policy price_list_items_del on public.price_list_items
for delete using (exists (
  select 1 from public.price_lists pl
  where pl.id = price_list_items.price_list_id
    and coalesce(pl.owner_id, auth.uid()) = auth.uid()
));
