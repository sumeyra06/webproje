-- Enable Row Level Security
alter table public.users enable row level security;

-- 1) Signup: allow anon to insert (adjust for your security model)
create policy if not exists users_signup_insert
on public.users for insert
to anon
with check (true);

-- 2) Self-select: allow users to select their own row if JWT email matches
-- Note: This requires requests to include a JWT with 'email' claim, typical with Supabase Auth.
-- If not using Supabase Auth, consider switching to server-side RPC for login.
create policy if not exists users_self_select
on public.users for select
to authenticated
using ( email = (current_setting('request.jwt.claims', true)::jsonb ->> 'email') );

-- 3) Admin updates: allow admins to update any row
-- Assumes JWT has 'role' claim set to 'admin'.
create policy if not exists users_admin_update
on public.users for update
to authenticated
using ( (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin' )
with check ( (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'admin' );

-- If you're not leveraging Supabase Auth/JWT claims, you should implement a secure RPC for login and
-- an admin service key context for role updates instead of broad client-side updates.
