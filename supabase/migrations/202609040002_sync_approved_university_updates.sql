-- Make approved university-database changes durable for every restored student.
-- Stable template IDs let subsequent renames and folder moves update the
-- matching personal copies instead of creating duplicates.

alter table public.subjects
  add column if not exists university_template_id text;

alter table public.drive_files
  add column if not exists university_template_id text;

create index if not exists subjects_university_template_id_idx
  on public.subjects (user_id, university_template_id)
  where university_template_id is not null;

create index if not exists drive_files_university_template_id_idx
  on public.drive_files (user_id, university_template_id)
  where university_template_id is not null;

-- Deliver the approved master-database change to active students immediately.
-- Offline students receive the already-saved changes on their next app load.
alter table public.university_databases replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'university_databases'
  ) then
    alter publication supabase_realtime add table public.university_databases;
  end if;
end
$$;
