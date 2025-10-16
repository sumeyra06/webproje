-- Supabase SQL: invoices table

create table if not exists public.invoices (
  id bigserial primary key,
  name text,
  customer_name text,
  collection_status text,
  edit_date date,
  due_date date,
  currency text,
  items jsonb,
  subtotal numeric(12,2),
  tax_total numeric(12,2),
  total numeric(12,2),
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- optional: create an index on edit_date for faster queries
create index if not exists invoices_edit_date_idx on public.invoices (edit_date);

-- trigger to update updated_at
create or replace function public.trigger_set_timestamp()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger invoices_set_timestamp
before update on public.invoices
for each row
execute procedure public.trigger_set_timestamp();
