-- KleiderPilot 0.10.1 – Geräte-Synchronisierung ohne sichtbaren Login
-- Dieses Skript einmal im Supabase SQL Editor ausführen.
-- Es ist NICHT destruktiv: die Tabellen/Buckets der 0.10 bleiben unangetastet.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.kleiderpilot_workspaces (
  id uuid primary key default gen_random_uuid(),
  pair_code text not null unique check (pair_code ~ '^[A-F0-9]{16}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.kleiderpilot_workspace_members (
  workspace_id uuid not null references public.kleiderpilot_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (user_id)
);

create index if not exists kleiderpilot_workspace_members_user_idx
  on public.kleiderpilot_workspace_members (user_id);

create table if not exists public.kleiderpilot_items_shared (
  workspace_id uuid not null references public.kleiderpilot_workspaces(id) on delete cascade,
  id text not null,
  sku text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (workspace_id, id)
);

create index if not exists kleiderpilot_items_shared_workspace_updated_idx
  on public.kleiderpilot_items_shared (workspace_id, updated_at desc);

alter table public.kleiderpilot_workspaces enable row level security;
alter table public.kleiderpilot_workspace_members enable row level security;
alter table public.kleiderpilot_items_shared enable row level security;

revoke all on public.kleiderpilot_workspaces from anon;
revoke all on public.kleiderpilot_workspace_members from anon;
revoke all on public.kleiderpilot_items_shared from anon;

revoke all on public.kleiderpilot_workspaces from authenticated;
revoke all on public.kleiderpilot_workspace_members from authenticated;
revoke all on public.kleiderpilot_items_shared from authenticated;

grant select on public.kleiderpilot_workspaces to authenticated;
grant select on public.kleiderpilot_workspace_members to authenticated;
grant select, insert, update, delete on public.kleiderpilot_items_shared to authenticated;

-- Ein Gerät darf nur seine eigene Workspace-Mitgliedschaft lesen.
drop policy if exists "KleiderPilot read own workspace membership" on public.kleiderpilot_workspace_members;
create policy "KleiderPilot read own workspace membership"
on public.kleiderpilot_workspace_members
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Ein Gerät darf nur den Workspace lesen, mit dem es gekoppelt ist.
drop policy if exists "KleiderPilot read joined workspace" on public.kleiderpilot_workspaces;
create policy "KleiderPilot read joined workspace"
on public.kleiderpilot_workspaces
for select
to authenticated
using (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_workspaces.id
      and m.user_id = (select auth.uid())
  )
);

-- Artikel sind für alle gekoppelten Geräte desselben Workspaces sichtbar/veränderbar.
drop policy if exists "KleiderPilot shared select" on public.kleiderpilot_items_shared;
create policy "KleiderPilot shared select"
on public.kleiderpilot_items_shared
for select
to authenticated
using (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_items_shared.workspace_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared insert" on public.kleiderpilot_items_shared;
create policy "KleiderPilot shared insert"
on public.kleiderpilot_items_shared
for insert
to authenticated
with check (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_items_shared.workspace_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared update" on public.kleiderpilot_items_shared;
create policy "KleiderPilot shared update"
on public.kleiderpilot_items_shared
for update
to authenticated
using (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_items_shared.workspace_id
      and m.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_items_shared.workspace_id
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared delete" on public.kleiderpilot_items_shared;
create policy "KleiderPilot shared delete"
on public.kleiderpilot_items_shared
for delete
to authenticated
using (
  exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id = kleiderpilot_items_shared.workspace_id
      and m.user_id = (select auth.uid())
  )
);

-- Erzeugt den persönlichen KleiderPilot-Workspace und einen zufälligen 16-stelligen Gerätecode.
create or replace function public.kp_create_workspace()
returns table (workspace_id uuid, pair_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'Keine Gerätesitzung vorhanden.';
  end if;

  select m.workspace_id, w.pair_code
    into v_workspace, v_code
  from public.kleiderpilot_workspace_members m
  join public.kleiderpilot_workspaces w on w.id = m.workspace_id
  where m.user_id = v_user
  limit 1;

  if v_workspace is not null then
    return query select v_workspace, v_code;
    return;
  end if;

  loop
    v_code := upper(encode(extensions.gen_random_bytes(8), 'hex'));
    exit when not exists (
      select 1 from public.kleiderpilot_workspaces w where w.pair_code = v_code
    );
  end loop;

  insert into public.kleiderpilot_workspaces (pair_code)
  values (v_code)
  returning id into v_workspace;

  insert into public.kleiderpilot_workspace_members (workspace_id, user_id)
  values (v_workspace, v_user);

  return query select v_workspace, v_code;
end;
$$;

-- Verbindet ein weiteres anonymes Gerät anhand des Gerätecodes mit demselben Workspace.
create or replace function public.kp_join_workspace(p_pair_code text)
returns table (workspace_id uuid, pair_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_code text;
begin
  if v_user is null then
    raise exception 'Keine Gerätesitzung vorhanden.';
  end if;

  v_code := regexp_replace(upper(coalesce(p_pair_code, '')), '[^A-F0-9]', '', 'g');
  if length(v_code) <> 16 then
    raise exception 'Ungültiger Gerätecode.';
  end if;

  select w.id
    into v_workspace
  from public.kleiderpilot_workspaces w
  where w.pair_code = v_code
  limit 1;

  if v_workspace is null then
    raise exception 'Gerätecode nicht gefunden.';
  end if;

  insert into public.kleiderpilot_workspace_members (workspace_id, user_id)
  values (v_workspace, v_user)
  on conflict (user_id)
  do update set workspace_id = excluded.workspace_id, joined_at = now();

  return query select v_workspace, v_code;
end;
$$;

revoke all on function public.kp_create_workspace() from public;
revoke all on function public.kp_join_workspace(text) from public;
grant execute on function public.kp_create_workspace() to authenticated;
grant execute on function public.kp_join_workspace(text) to authenticated;

-- Privater Bildspeicher. Pfad: <workspace-id>/<artikel-id>/<bild>.jpg
insert into storage.buckets (id, name, public)
values ('kleiderpilot-images-shared', 'kleiderpilot-images-shared', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "KleiderPilot shared read images" on storage.objects;
create policy "KleiderPilot shared read images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kleiderpilot-images-shared'
  and exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared upload images" on storage.objects;
create policy "KleiderPilot shared upload images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kleiderpilot-images-shared'
  and exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared update images" on storage.objects;
create policy "KleiderPilot shared update images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'kleiderpilot-images-shared'
  and exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'kleiderpilot-images-shared'
  and exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);

drop policy if exists "KleiderPilot shared delete images" on storage.objects;
create policy "KleiderPilot shared delete images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kleiderpilot-images-shared'
  and exists (
    select 1
    from public.kleiderpilot_workspace_members m
    where m.workspace_id::text = (storage.foldername(name))[1]
      and m.user_id = (select auth.uid())
  )
);
