-- KleiderPilot 0.10 Cloud Sync
-- Dieses Skript einmal im Supabase SQL Editor ausführen.

create table if not exists public.kleiderpilot_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  sku text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists kleiderpilot_items_user_updated_idx
  on public.kleiderpilot_items (user_id, updated_at desc);

alter table public.kleiderpilot_items enable row level security;

revoke all on public.kleiderpilot_items from anon;
grant select, insert, update, delete on public.kleiderpilot_items to authenticated;

-- RLS: Jeder eingeloggte Nutzer sieht und verändert ausschließlich seine eigenen Artikel.
drop policy if exists "KleiderPilot select own items" on public.kleiderpilot_items;
create policy "KleiderPilot select own items"
on public.kleiderpilot_items
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "KleiderPilot insert own items" on public.kleiderpilot_items;
create policy "KleiderPilot insert own items"
on public.kleiderpilot_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "KleiderPilot update own items" on public.kleiderpilot_items;
create policy "KleiderPilot update own items"
on public.kleiderpilot_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "KleiderPilot delete own items" on public.kleiderpilot_items;
create policy "KleiderPilot delete own items"
on public.kleiderpilot_items
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Privater Bildspeicher. Dateien liegen immer unter <user-id>/<artikel-id>/...
insert into storage.buckets (id, name, public)
values ('kleiderpilot-images', 'kleiderpilot-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "KleiderPilot read own images" on storage.objects;
create policy "KleiderPilot read own images"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'kleiderpilot-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "KleiderPilot upload own images" on storage.objects;
create policy "KleiderPilot upload own images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'kleiderpilot-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "KleiderPilot update own images" on storage.objects;
create policy "KleiderPilot update own images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'kleiderpilot-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'kleiderpilot-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "KleiderPilot delete own images" on storage.objects;
create policy "KleiderPilot delete own images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'kleiderpilot-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
