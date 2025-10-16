-- Enable RLS and add policies for public.offers (idempotent)
alter table if exists public.offers enable row level security;

-- Allow owners to read their own rows
create policy if not exists offers_select_own on public.offers
  for select using (owner_id = auth.uid());

-- Allow owners to insert their own rows
create policy if not exists offers_insert_own on public.offers
  for insert with check (owner_id = auth.uid());

-- Allow owners to update their own rows
create policy if not exists offers_update_own on public.offers
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Allow owners to delete their own rows
create policy if not exists offers_delete_own on public.offers
  for delete using (owner_id = auth.uid());
