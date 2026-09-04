-- Keep a restored academic database as a live, approved source subscription.
-- This prevents an imported backup from becoming a disconnected copy.

create table if not exists public.database_restore_links (
  subscriber_id uuid primary key references auth.users(id) on delete cascade,
  source_owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint database_restore_links_different_users
    check (subscriber_id <> source_owner_id)
);

alter table public.database_restore_links enable row level security;

drop policy if exists "Students can view their own restored database link" on public.database_restore_links;
create policy "Students can view their own restored database link"
  on public.database_restore_links
  for select
  using (subscriber_id = auth.uid());

drop policy if exists "Students can create their own restored database link" on public.database_restore_links;
create policy "Students can create their own restored database link"
  on public.database_restore_links
  for insert
  with check (subscriber_id = auth.uid());

drop policy if exists "Students can update their own restored database link" on public.database_restore_links;
create policy "Students can update their own restored database link"
  on public.database_restore_links
  for update
  using (subscriber_id = auth.uid())
  with check (subscriber_id = auth.uid());

-- `subjects` remains owner-scoped for normal writes. This function is the only
-- read path that additionally exposes the linked source to its subscriber.
create or replace function public.get_visible_subjects_for_current_user()
returns setof public.subjects
language sql
security definer
set search_path = public
as $$
  select s.*
  from public.subjects s
  where s.user_id = auth.uid()

  union

  select s.*
  from public.subjects s
  join public.database_restore_links link
    on link.source_owner_id = s.user_id
  where link.subscriber_id = auth.uid();
$$;

revoke all on function public.get_visible_subjects_for_current_user() from public;
grant execute on function public.get_visible_subjects_for_current_user() to authenticated;
