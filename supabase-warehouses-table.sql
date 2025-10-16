-- supabase-warehouses-table.sql
-- Run this in your Supabase SQL editor to create a warehouses table

CREATE TABLE IF NOT EXISTS public.warehouses (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  address text,
  foreign_address boolean DEFAULT false,
  district text,
  city text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Optional: grant access to anon role if you want public insert/select via API keys
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO anon;
