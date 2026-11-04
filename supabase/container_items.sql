-- Columns used by the container items table.
-- Safe to run more than once.

alter table public.container_items
  add column if not exists width numeric,
  add column if not exists length numeric,
  add column if not exists height numeric,
  add column if not exists notes text;

notify pgrst, 'reload schema';
