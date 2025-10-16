-- Support messages table
create table if not exists public.support_messages (
  id bigserial primary key,
  user_id uuid not null,
  user_email text,
  user_full_name text,
  subject text,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists idx_support_messages_user on public.support_messages(user_id);
