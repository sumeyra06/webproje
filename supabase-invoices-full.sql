-- Full creation script for invoices table (idempotent)
-- Run this in Supabase SQL editor. Adjust schema if needed.

-- 1. Table
create table if not exists public.invoices (
  id bigserial primary key,
  name text,
  invoice_no text,
  customer_name text,
  category text,
  tags text[],
  stock_tracking_mode text check (stock_tracking_mode in ('out','noout')) default 'out',
  collection_status text check (collection_status in ('pending','collected')) default 'pending',
  edit_date date,
  due_date date,
  currency text default 'TRY',
  items jsonb, -- [{desc, qty, unit, price, tax, lineTotal}]
  subtotal numeric(14,2),
  tax_total numeric(14,2),
  total numeric(14,2),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Ensure new columns exist if table pre-existed (safety)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='invoice_no') THEN
    ALTER TABLE public.invoices ADD COLUMN invoice_no text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='category') THEN
    ALTER TABLE public.invoices ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='tags') THEN
    ALTER TABLE public.invoices ADD COLUMN tags text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='stock_tracking_mode') THEN
    ALTER TABLE public.invoices ADD COLUMN stock_tracking_mode text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoices' AND column_name='collection_status') THEN
    ALTER TABLE public.invoices ADD COLUMN collection_status text;
  END IF;
END$$;

-- 3. Basic indexes
create index if not exists invoices_edit_date_idx on public.invoices (edit_date);
create index if not exists invoices_due_date_idx on public.invoices (due_date);
create index if not exists invoices_invoice_no_idx on public.invoices (invoice_no);
create index if not exists invoices_collection_status_idx on public.invoices (collection_status);

-- Tags GIN index (array operations / ANY) (optional)
create index if not exists invoices_tags_gin_idx on public.invoices using gin (tags);

-- 4. Updated_at trigger
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_timestamp_invoices
before update on public.invoices
for each row execute procedure public.set_timestamp();

-- 5. (Optional) Unique constraint for invoice_no if you want uniqueness
-- ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);

-- 6. (Optional) Row Level Security policies (enable & example). Uncomment to use.
-- ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
-- create policy "Allow anon read" on public.invoices for select using (true);
-- create policy "Allow service role full" on public.invoices for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
-- create policy "Allow authenticated crud" on public.invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 7. Quick test query suggestion:
-- select id, invoice_no, name, total from public.invoices order by id desc limit 10;
