-- Users table for email/password auth with roles
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  company_title text,
  phone text,
  email text not null unique,
  password_hash text not null,
  role text not null default 'user', -- e.g., admin, user, finance, sales
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_email_lower on public.users (lower(email));

-- For existing databases where the column may be missing
alter table if exists public.users
  add column if not exists is_active boolean not null default true;
