-- Full creation script for expenses table (idempotent)
-- Run in Supabase SQL Editor. Adjust schema as needed.

-- 1) Table
create table if not exists public.expenses (
  id bigserial primary key,
  owner_id uuid not null,
  title text not null,
  category text,
  expense_date date,
  supplier_name text,
  employee_name text,
  currency text default 'TRY',
  amount numeric(14,2) default 0,
  tax_rate numeric(6,2) default 0,
  tax_amount numeric(14,2) default 0,
  total numeric(14,2) default 0,
  payment_status text check (payment_status in ('pending','paid','partial')) default 'pending',
  payment_date date,
  tags text[],
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Ensure columns exist if table pre-existed (safety)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='owner_id') THEN
    ALTER TABLE public.expenses ADD COLUMN owner_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='title') THEN
    ALTER TABLE public.expenses ADD COLUMN title text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category') THEN
    ALTER TABLE public.expenses ADD COLUMN category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='expense_date') THEN
    ALTER TABLE public.expenses ADD COLUMN expense_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='supplier_name') THEN
    ALTER TABLE public.expenses ADD COLUMN supplier_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='employee_name') THEN
    ALTER TABLE public.expenses ADD COLUMN employee_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='currency') THEN
    ALTER TABLE public.expenses ADD COLUMN currency text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='amount') THEN
    ALTER TABLE public.expenses ADD COLUMN amount numeric(14,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tax_rate') THEN
    ALTER TABLE public.expenses ADD COLUMN tax_rate numeric(6,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tax_amount') THEN
    ALTER TABLE public.expenses ADD COLUMN tax_amount numeric(14,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='total') THEN
    ALTER TABLE public.expenses ADD COLUMN total numeric(14,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='payment_status') THEN
    ALTER TABLE public.expenses ADD COLUMN payment_status text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='payment_date') THEN
    ALTER TABLE public.expenses ADD COLUMN payment_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tags') THEN
    ALTER TABLE public.expenses ADD COLUMN tags text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='notes') THEN
    ALTER TABLE public.expenses ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='created_at') THEN
    ALTER TABLE public.expenses ADD COLUMN created_at timestamptz default now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='updated_at') THEN
    ALTER TABLE public.expenses ADD COLUMN updated_at timestamptz default now();
  END IF;
END$$;

-- 3) Helpful indexes
create index if not exists expenses_owner_idx on public.expenses (owner_id);
create index if not exists expenses_date_idx on public.expenses (expense_date);
create index if not exists expenses_payment_status_idx on public.expenses (payment_status);
create index if not exists expenses_category_idx on public.expenses (category);
create index if not exists expenses_supplier_idx on public.expenses (supplier_name);
create index if not exists expenses_tags_gin_idx on public.expenses using gin (tags);

-- 4) updated_at trigger (re-use or create helper)
create or replace function public.set_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_timestamp_expenses on public.expenses;
create trigger set_timestamp_expenses
before update on public.expenses
for each row execute procedure public.set_timestamp();

-- 4.b) Optional helper: set owner_id from Supabase Auth automatically on INSERT (if not provided)
create or replace function public.expenses_set_owner_from_auth()
returns trigger as $$
begin
  -- If client didn't provide owner_id but request has an authenticated user,
  -- set owner_id = auth.uid() so RLS checks pass.
  if new.owner_id is null and auth.uid() is not null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_owner_from_auth_expenses on public.expenses;
create trigger set_owner_from_auth_expenses
before insert on public.expenses
for each row execute procedure public.expenses_set_owner_from_auth();

-- 5) Row Level Security (recommended)
alter table public.expenses enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Expenses select own'
  ) THEN
    CREATE POLICY "Expenses select own" ON public.expenses
      FOR SELECT
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Expenses insert own'
  ) THEN
    CREATE POLICY "Expenses insert own" ON public.expenses
      FOR INSERT
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Expenses update own'
  ) THEN
    CREATE POLICY "Expenses update own" ON public.expenses
      FOR UPDATE
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses' AND policyname = 'Expenses delete own'
  ) THEN
    CREATE POLICY "Expenses delete own" ON public.expenses
      FOR DELETE
      USING (owner_id = auth.uid());
  END IF;
END$$;

-- 6) Quick test
-- select id, title, total from public.expenses order by id desc limit 10;

-- 7) DEV-ONLY (optional): Allow anon CRUD without Supabase Auth
-- NOTE: This relaxes security. Use only in development. Remove in production.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='expenses' AND policyname='Expenses anon select (dev)'
  ) THEN
    CREATE POLICY "Expenses anon select (dev)" ON public.expenses
      FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='expenses' AND policyname='Expenses anon insert (dev)'
  ) THEN
    CREATE POLICY "Expenses anon insert (dev)" ON public.expenses
      FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='expenses' AND policyname='Expenses anon update (dev)'
  ) THEN
    CREATE POLICY "Expenses anon update (dev)" ON public.expenses
      FOR UPDATE TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='expenses' AND policyname='Expenses anon delete (dev)'
  ) THEN
    CREATE POLICY "Expenses anon delete (dev)" ON public.expenses
      FOR DELETE TO anon USING (true);
  END IF;
END$$;
