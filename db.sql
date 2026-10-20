-- NutriTrack - configurazione del database Supabase
-- Esegui questo file nell'SQL Editor di Supabase.
--
-- Cosa crea:
--   1. La tabella public.profiles con contatti, altezza e inizio dieta.
--   2. La tabella public.measurements con lo storico delle misurazioni.
--   3. I trigger per creare il profilo e sincronizzare l'email da auth.users.
--   4. Le policy RLS per clienti e nutrizionista.
--   5. La funzione RPC con cui la nutrizionista imposta l'inizio dieta.
--
-- Progetto con una sola nutrizionista:
--   Dopo che la nutrizionista si e' registrata, promuovila con:
--   update public.profiles set role = 'nutritionist'
--   where email = 'indirizzo-della-nutrizionista@example.com';

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  phone text,
  height_cm numeric(5, 1),
  diet_start_date date,
  role text not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    char_length(trim(display_name)) between 1 and 60
  ),
  constraint profiles_role_check check (role in ('client', 'nutritionist')),
  constraint profiles_phone_length check (
    phone is null or char_length(phone) <= 30
  ),
  constraint profiles_height_range check (
    height_cm is null or height_cm between 50 and 250
  )
);

-- Colonne aggiunte per aggiornare un'installazione gia' esistente.
alter table public.profiles
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists height_cm numeric(5, 1),
  add column if not exists diet_start_date date;

-- Aggiunge i vincoli anche quando le colonne esistevano gia'.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_phone_length'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_length
      check (phone is null or char_length(phone) <= 30);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_height_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_height_range
      check (height_cm is null or height_cm between 50 and 250);
  end if;
end;
$$;

comment on table public.profiles is
  'Profilo applicativo collegato uno-a-uno con un account auth.users.';
comment on column public.profiles.role is
  'Ruolo applicativo. Le registrazioni pubbliche ricevono sempre il ruolo client.';
comment on column public.profiles.email is
  'Email di accesso sincronizzata da auth.users, mostrata in sola lettura.';
comment on column public.profiles.diet_start_date is
  'Data di inizio dieta impostata dalla nutrizionista tramite RPC.';

create index if not exists profiles_role_idx on public.profiles (role);

-- Allinea eventuali profili creati prima dell'introduzione della colonna email.
update public.profiles as p
set email = u.email
from auth.users as u
where p.id = u.id
  and p.email is distinct from u.email;

-- Permessi di base: gli utenti anonimi non accedono ai profili.
-- L'email, il ruolo e la data dieta non sono modificabili direttamente.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, phone, height_cm) on table public.profiles to authenticated;

alter table public.profiles enable row level security;

-- Evita la ricorsione delle policy quando si controlla il ruolo.
-- La funzione legge solo il ruolo dell'utente autenticato corrente.
create or replace function public.is_nutritionist()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'nutritionist'
  );
$$;

revoke all on function public.is_nutritionist() from public;
revoke all on function public.is_nutritionist() from anon;
grant execute on function public.is_nutritionist() to authenticated;

drop policy if exists "Profili visibili al proprietario o alla nutrizionista"
  on public.profiles;
create policy "Profili visibili al proprietario o alla nutrizionista"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (public.is_nutritionist() and role = 'client')
  );

drop policy if exists "Utenti aggiornano il proprio profilo"
  on public.profiles;
create policy "Utenti aggiornano il proprio profilo"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Crea un profilo per ogni nuovo utente. Il ruolo e' sempre assegnato dal
-- database e non proviene dai metadati modificabili dal browser.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
  resolved_name text;
begin
  requested_name := nullif(trim(new.raw_user_meta_data ->> 'display_name'), '');

  resolved_name := coalesce(
    requested_name,
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Utente'
  );

  insert into public.profiles (id, display_name, email, role)
  values (new.id, left(resolved_name, 60), new.email, 'client')
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon, authenticated;

-- Mantiene sincronizzata l'email di accesso nel profilo.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  execute function public.handle_user_email_change();

revoke all on function public.handle_user_email_change() from public;
revoke all on function public.handle_user_email_change() from anon, authenticated;

-- Aggiorna updated_at e impedisce ai clienti autenticati di cambiare ruolo.
create or replace function public.handle_profile_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and current_user = 'authenticated' then
    raise exception 'Solo un amministratore puo'' modificare il ruolo del profilo.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row
  execute function public.handle_profile_update();

revoke all on function public.handle_profile_update() from public;
revoke all on function public.handle_profile_update() from anon, authenticated;

-- Storico delle misurazioni. Il peso e' obbligatorio, le circonferenze no.
create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5, 1) not null,
  waist_cm numeric(5, 1),
  hips_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  neck_cm numeric(5, 1),
  notes text,
  created_at timestamptz not null default now(),
  constraint measurements_weight_range check (weight_kg between 20 and 400),
  constraint measurements_waist_range check (
    waist_cm is null or waist_cm between 20 and 250
  ),
  constraint measurements_hips_range check (
    hips_cm is null or hips_cm between 20 and 250
  ),
  constraint measurements_chest_range check (
    chest_cm is null or chest_cm between 20 and 250
  ),
  constraint measurements_arm_range check (
    arm_cm is null or arm_cm between 10 and 150
  ),
  constraint measurements_thigh_range check (
    thigh_cm is null or thigh_cm between 20 and 250
  ),
  constraint measurements_neck_range check (
    neck_cm is null or neck_cm between 10 and 150
  ),
  constraint measurements_notes_length check (
    notes is null or char_length(notes) <= 1000
  )
);

comment on table public.measurements is
  'Rilevazioni private del paziente, leggibili anche dalla nutrizionista.';

create index if not exists measurements_client_date_idx
  on public.measurements (client_id, measured_on desc, created_at desc);

revoke all on table public.measurements from anon, authenticated;
grant select, insert, delete on table public.measurements to authenticated;

alter table public.measurements enable row level security;

drop policy if exists "Misurazioni visibili al proprietario o alla nutrizionista"
  on public.measurements;
create policy "Misurazioni visibili al proprietario o alla nutrizionista"
  on public.measurements
  for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or public.is_nutritionist()
  );

drop policy if exists "Il proprietario inserisce le proprie misurazioni"
  on public.measurements;
create policy "Il proprietario inserisce le proprie misurazioni"
  on public.measurements
  for insert
  to authenticated
  with check (client_id = (select auth.uid()));

drop policy if exists "Il proprietario elimina le proprie misurazioni"
  on public.measurements;
create policy "Il proprietario elimina le proprie misurazioni"
  on public.measurements
  for delete
  to authenticated
  using (client_id = (select auth.uid()));

-- La nutrizionista e' l'unica a poter impostare la data di inizio dieta.
create or replace function public.set_diet_start_date(
  p_client_id uuid,
  p_date date
)
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_date date;
begin
  if not public.is_nutritionist() then
    raise exception 'Solo la nutrizionista puo'' impostare la data di inizio dieta.'
      using errcode = '42501';
  end if;

  if p_date is null then
    raise exception 'La data di inizio dieta e'' obbligatoria.'
      using errcode = '22023';
  end if;

  update public.profiles
  set diet_start_date = p_date
  where id = p_client_id
    and role = 'client'
  returning diet_start_date into updated_date;

  if updated_date is null then
    raise exception 'Paziente non trovato.'
      using errcode = 'P0002';
  end if;

  return updated_date;
end;
$$;

revoke all on function public.set_diet_start_date(uuid, date) from public;
revoke all on function public.set_diet_start_date(uuid, date) from anon;
grant execute on function public.set_diet_start_date(uuid, date) to authenticated;
