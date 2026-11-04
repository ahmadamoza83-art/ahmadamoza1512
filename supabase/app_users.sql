-- The app_users table already exists.
-- Run this once if adding or deleting users is blocked by row level security.

alter table public.app_users enable row level security;

grant select, insert, delete on table public.app_users to anon, authenticated;

drop policy if exists app_users_select on public.app_users;
create policy app_users_select
on public.app_users
for select
to anon, authenticated
using (true);

drop policy if exists app_users_insert on public.app_users;
create policy app_users_insert
on public.app_users
for insert
to anon, authenticated
with check (true);

drop policy if exists app_users_delete on public.app_users;
create policy app_users_delete
on public.app_users
for delete
to anon, authenticated
using (true);
