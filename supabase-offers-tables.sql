-- Uygulama koduyla birebir uyumlu şema (idempotent kurulumlar için referans)
create table if not exists public.offers (
  id bigserial primary key,
  name text, -- Teklif adı
  customer_name text, -- Müşteri adı (serbest metin)
  customer_id bigint references public.customers(id), -- Opsiyonel ilişki
  -- Genel başvuru formu (apply.js) ile uyumlu opsiyonel alanlar
  email text,
  phone text,
  status text,
  requested_service text,
  edit_date date,
  due_date date,
  currency text default 'TRY',
  terms text, -- Teklif koşulları
  items jsonb default '[]'::jsonb, -- Satırların JSON listesi
  subtotal numeric(18,2) default 0,
  tax_total numeric(18,2) default 0,
  total numeric(18,2) default 0,
  owner_id uuid, -- Çoklu kiracılık için
  created_at timestamptz not null default now()
);

create table if not exists public.offer_items (
  id bigserial primary key,
  offer_id bigint references public.offers(id) on delete cascade,
  product_name text not null,
  quantity numeric(18,2),
  unit text,
  unit_price numeric(18,2),
  vat_rate numeric(5,2),
  vat_amount numeric(18,2),
  total numeric(18,2)
);
