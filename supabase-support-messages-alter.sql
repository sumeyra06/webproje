-- Align support_messages table with app expectations.
-- Safe to run multiple times (idempotent).

-- Core columns
alter table if exists public.support_messages add column if not exists user_id uuid;
alter table if exists public.support_messages add column if not exists user_email text;
alter table if exists public.support_messages add column if not exists user_full_name text;
alter table if exists public.support_messages add column if not exists subject text;
alter table if exists public.support_messages add column if not exists message text;
alter table if exists public.support_messages add column if not exists status text default 'open';
alter table if exists public.support_messages add column if not exists created_at timestamptz default now();

-- Indexes
create index if not exists idx_support_messages_user on public.support_messages(user_id);

-- Notes:
-- 1) We intentionally avoid NOT NULL constraints in the ALTER to prevent failures when legacy rows exist.
--    If you want NOT NULL, enforce after backfilling:
--    update public.support_messages set status = coalesce(status, 'open');
--    alter table public.support_messages alter column status set not null;
--    alter table public.support_messages alter column created_at set not null;
-- 2) Running this script refreshes PostgREST schema cache automatically.
