-- supabase-stock-report-tables.sql
-- Amaç: Stoktaki Ürünler Raporu için gerekli tablo ve görünümler
-- Notlar:
-- - Var olan products tablosunu korur, eksik alanları ekler (ALIŞ ve SATIŞ fiyatları, kod/sku)
-- - Rapor için iki VIEW oluşturur: satır bazlı ve toplamlar

-- UUID üretimi için (Supabase'de genellikle açıktır)
create extension if not exists "pgcrypto";

-- 1) Ürünler tablosu (yoksa oluştur)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  barcode text,
  category text,
  stock integer not null default 0 check (stock >= 0), -- toplam stok (view ve hızlı erişim için)
  purchase_price numeric(18,2) not null default 0, -- alış fiyatı
  sale_price numeric(18,2) not null default 0,     -- satış fiyatı
  vat_rate numeric(5,2) default 0,                 -- KDV (%)
  other_taxes jsonb,                                -- diğer vergiler [{name, rate|amount, type}]
  unit text default 'Adet',                         -- ALIŞ / SATIŞ BİRİMİ
  stock_tracking boolean not null default true,     -- STOK TAKİBİ
  critical_stock_total numeric(18,2),               -- toplam kritik stok eşiği
  photo_url text,                                   -- ürün fotoğrafı
  gtip_code text,                                   -- GTİP
  price numeric(18,2),                             -- mevcut uygulama uyumluluğu (opsiyonel)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 1.a) Var olan products tablosu için eksik alanları ekle
alter table public.products
  add column if not exists code text,
  add column if not exists barcode text,
  add column if not exists category text,
  add column if not exists stock integer not null default 0,
  add column if not exists purchase_price numeric(18,2) not null default 0,
  add column if not exists sale_price numeric(18,2) not null default 0,
  add column if not exists vat_rate numeric(5,2) default 0,
  add column if not exists other_taxes jsonb,
  add column if not exists unit text default 'Adet',
  add column if not exists stock_tracking boolean not null default true,
  add column if not exists critical_stock_total numeric(18,2),
  add column if not exists photo_url text,
  add column if not exists gtip_code text,
  add column if not exists price numeric(18,2),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- 1.b) code alanı için benzersiz indeks (tablo oluştururken unique varsa tekrar eklenmez)
create unique index if not exists idx_products_code_unique on public.products(code);

-- 1.c) Yardımcı indeksler
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_stock on public.products(stock);
create index if not exists idx_products_name_lower on public.products (lower(name));
create index if not exists idx_products_barcode on public.products(barcode);

-- 1.c.1) Ürün kodu için otomatik numaralandırma (PRD-000001, PRD-000002 ...)
-- Not: code benzersiz indeks olduğundan, boş gelenleri biz dolduracağız
create sequence if not exists public.seq_product_code start 1;

create or replace function public.next_product_code()
returns text as $$
declare
  nextval_int bigint;
begin
  -- Sıra değeri al
  nextval_int := nextval('public.seq_product_code');
  -- PRD-000001 formatında döndür
  return 'PRD-' || lpad(nextval_int::text, 6, '0');
end;
$$ language plpgsql;

-- Insert öncesi boş/NULL code alanını otomatik dolduran tetikleyici
create or replace function public.products_code_autofill()
returns trigger as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_product_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_code_autofill on public.products;
create trigger trg_products_code_autofill
before insert on public.products
for each row execute function public.products_code_autofill();

-- Update sırasında code boşaltılırsa tekrar atayan tetikleyici (opsiyonel)
create or replace function public.products_code_reassign_if_empty()
returns trigger as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := public.next_product_code();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_code_reassign on public.products;
create trigger trg_products_code_reassign
before update of code on public.products
for each row execute function public.products_code_reassign_if_empty();

-- 1.d) updated_at alanını otomatik güncelleyen tetikleyici
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- 1.e) Mevcut price kolonu (varsa) üzerinden sale_price başlangıç değeri
update public.products p
set sale_price = coalesce(p.sale_price, 0) + case when p.sale_price = 0 and p.price is not null then p.price else 0 end
where true;

-- 1.f) Bazı kurulumlarda products(product_id) NOT NULL ama defaultsuz olabilir.
-- Bu durumda yeni eklemelerde NOT NULL ihlali olur. Aşağıdaki blok, varsa
-- product_id için uygun bir DEFAULT tanımlar (uuid ise gen_random_uuid, tamsayı ise sequence).
do $$
declare
  v_data_type text;
  v_udt_name text;
  v_has_default boolean;
begin
  select data_type, udt_name, (column_default is not null)
    into v_data_type, v_udt_name, v_has_default
  from information_schema.columns
  where table_schema='public' and table_name='products' and column_name='product_id';

  if found then
    -- NULL değerleri geriye dönük doldur
    begin
      if v_data_type = 'uuid' then
        execute 'update public.products set product_id = id where product_id is null';
        if not v_has_default then
          execute 'alter table public.products alter column product_id set default gen_random_uuid()';
        end if;
      elsif v_udt_name in ('text','varchar') then
        execute 'update public.products set product_id = id::text where product_id is null';
        if not v_has_default then
          execute 'alter table public.products alter column product_id set default gen_random_uuid()::text';
        end if;
      elsif v_udt_name in ('int2','int4','int8') then
        execute 'create sequence if not exists products_product_id_seq';
        execute 'select setval(''products_product_id_seq'', coalesce((select max(product_id)::bigint from public.products),0))';
        execute 'update public.products set product_id = nextval(''products_product_id_seq'') where product_id is null';
        if not v_has_default then
          execute 'alter table public.products alter column product_id set default nextval(''products_product_id_seq'')';
        end if;
      end if;
    exception when others then
      -- geçici hataları yut
      null;
    end;

    -- Insertlerde product_id boş kalırsa id'den dolduran tetikleyici (uuid/text tipleri için)
    if v_data_type = 'uuid' then
      execute $$create or replace function public.products_product_id_fill() returns trigger as $$
      begin
        if new.product_id is null then new.product_id := new.id; end if;
        return new;
      end; $$ language plpgsql;$$;
      execute 'drop trigger if exists trg_products_product_id_fill on public.products';
      execute 'create trigger trg_products_product_id_fill before insert on public.products for each row execute function public.products_product_id_fill()';
    elsif v_udt_name in ('text','varchar') then
      execute $$create or replace function public.products_product_id_fill_text() returns trigger as $$
      begin
        if new.product_id is null then new.product_id := new.id::text; end if;
        return new;
      end; $$ language plpgsql;$$;
      execute 'drop trigger if exists trg_products_product_id_fill on public.products';
      execute 'create trigger trg_products_product_id_fill before insert on public.products for each row execute function public.products_product_id_fill_text()';
    end if;
  end if;
end $$;

-- Önce mevcut görünümleri düşür (kolon adı/sırası değişiklikleri için gereklidir)
drop view if exists public.stock_report_view;
drop view if exists public.stock_report_totals_view;

-- 2) Rapor görünümleri (stokta olan ürünler)
create view public.stock_report_view as
select
  p.id,
  p.name as product_name,
  p.code as product_code,
  p.barcode,
  p.category,
  p.stock as stock_quantity,
  p.vat_rate,
  -- Birim fiyatlar: hem KDV hariç (ham) hem KDV dahil gösterim
  p.purchase_price as purchase_price_excl,
  (p.purchase_price * (
    1 + (
      coalesce(p.vat_rate,0) + coalesce((
        select sum(coalesce((t->>'rate')::numeric,0))
        from jsonb_array_elements(p.other_taxes) t
        where coalesce(t->>'type','rate') = 'rate'
      ),0)
    ) / 100.0
  )) as purchase_price_incl,
  p.sale_price as sale_price_excl,
  (p.sale_price * (
    1 + (
      coalesce(p.vat_rate,0) + coalesce((
        select sum(coalesce((t->>'rate')::numeric,0))
        from jsonb_array_elements(p.other_taxes) t
        where coalesce(t->>'type','rate') = 'rate'
      ),0)
    ) / 100.0
  )) as sale_price_incl,
  -- Ürün bazlı KDV (satış: KDV hariç * KDV oranı)
  (p.sale_price * (coalesce(p.vat_rate,0) / 100.0)) as unit_vat_from_sale,
  -- KDV (alış): birim alış KDV'si ve stok toplamı
  (p.purchase_price * (coalesce(p.vat_rate,0) / 100.0)) as unit_vat_from_purchase,
  -- Stoktaki toplam KDV (birim KDV * stok)
  (p.stock * (p.sale_price * (coalesce(p.vat_rate,0) / 100.0))) as stock_vat_total,
  (p.stock * (p.purchase_price * (coalesce(p.vat_rate,0) / 100.0))) as stock_purchase_vat_total,
  -- Stok maliyeti ve satış değeri: KDV Hariç (net)
  (p.stock * p.purchase_price) as stock_cost,
  (p.stock * p.sale_price) as sale_value,
  -- Net satış karı (KDV hariç): satış - alış
  ((p.stock * p.sale_price) - (p.stock * p.purchase_price)) as sales_profit,
  -- Kar oranı (%) - KDV Hariç değerler üzerinden
  (case when p.purchase_price > 0 then ((p.sale_price - p.purchase_price) / p.purchase_price) * 100.0 else null end) as profit_margin_pct,
  p.stock_tracking,
  p.updated_at
from public.products p;

-- Toplam özet görünümü
create view public.stock_report_totals_view as
select
  -- Bilgi amaçlı: vergiler dahil birim fiyatlar (toplamlarda kullanılmıyor, satır bazlıda mevcut)
  null::numeric as sample_purchase_price_incl,
  null::numeric as sample_sale_price_incl,
  sum(p.stock * p.purchase_price) as total_stock_cost,
  sum(p.stock * p.sale_price)     as total_sale_value,
  (sum(p.stock * p.sale_price) - sum(p.stock * p.purchase_price)) as total_sales_profit,
  sum(p.stock * (p.sale_price * (coalesce(p.vat_rate,0) / 100.0))) as total_stock_vat,
  sum(p.stock * (p.purchase_price * (coalesce(p.vat_rate,0) / 100.0))) as total_stock_purchase_vat
from public.products p
where coalesce(p.stock,0) > 0;

-- Kullanım:
-- select * from public.stock_report_view order by product_name;
-- select * from public.stock_report_totals_view;
