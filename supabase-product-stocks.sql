-- Ürün stoklarını depo bazında tutmak için ara tablo (products.id tipine göre dinamik)
do $$
declare
  v_udt_name text;
  v_coltype text;
begin
  select udt_name into v_udt_name
  from information_schema.columns
  where table_schema='public' and table_name='products' and column_name='id';

  if not found then
    raise exception 'public.products.id kolonu bulunamadı';
  end if;

  -- Tip eşlemesi (uuid/int4/int8)
  if v_udt_name = 'uuid' then
    v_coltype := 'uuid';
  elsif v_udt_name = 'int8' then
    v_coltype := 'bigint';
  elsif v_udt_name = 'int4' then
    v_coltype := 'integer';
  else
    -- diğer tipler için olduğu gibi kullan
    v_coltype := v_udt_name;
  end if;

  execute format($sql$
    create table if not exists public.product_stocks (
      id bigserial primary key,
      product_id %s not null references public.products(id) on delete cascade,
      warehouse_id bigint not null references public.warehouses(id) on delete cascade,
      quantity numeric(18,2) not null default 0,
      critical_threshold numeric(18,2),
      unique (product_id, warehouse_id)
    )
  $sql$, v_coltype);
end $$;

create index if not exists idx_product_stocks_product on public.product_stocks(product_id);
create index if not exists idx_product_stocks_warehouse on public.product_stocks(warehouse_id);

-- products.stock toplamını product_stocks üzerinden senkron tutan view ve trigger alternatifi
create or replace function public.sync_product_total_stock()
returns trigger as $$
begin
  update public.products p
  set stock = coalesce((select sum(s.quantity) from public.product_stocks s where s.product_id = p.id), 0)
  where p.id = new.product_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_product_stocks_sync_ins on public.product_stocks;
create trigger trg_product_stocks_sync_ins
after insert on public.product_stocks
for each row execute function public.sync_product_total_stock();

drop trigger if exists trg_product_stocks_sync_upd on public.product_stocks;
create trigger trg_product_stocks_sync_upd
after update on public.product_stocks
for each row execute function public.sync_product_total_stock();

drop trigger if exists trg_product_stocks_sync_del on public.product_stocks;
create trigger trg_product_stocks_sync_del
after delete on public.product_stocks
for each row execute function public.sync_product_total_stock();
