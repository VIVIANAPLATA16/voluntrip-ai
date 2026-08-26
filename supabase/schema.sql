-- Voluntrip AI — Supabase schema + RLS
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Traveler',
  locale text not null default 'en',
  preferred_currency text not null default 'USD',
  onboarding_complete boolean not null default false,
  avatar_hue integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  destination text not null,
  city text not null,
  country text not null,
  country_code text not null default '',
  flag text not null default '',
  base_currency text not null,
  local_currency text not null,
  start_date date not null,
  end_date date not null,
  initial_budget numeric not null default 0,
  host_name text,
  included_benefits jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips (user_id);

create table if not exists public.pockets (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  balance numeric not null default 0,
  allocated numeric not null default 0,
  protected boolean not null default false,
  icon text not null default 'wallet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pockets_user_id_idx on public.pockets (user_id);
create index if not exists pockets_trip_id_idx on public.pockets (trip_id);

create table if not exists public.transactions (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pocket_id uuid references public.pockets (id) on delete set null,
  amount_original numeric not null,
  currency_original text not null,
  exchange_rate numeric not null default 1,
  amount_base numeric not null,
  currency_base text not null,
  concept text not null,
  category text not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  note text
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_trip_id_idx on public.transactions (trip_id);

create table if not exists public.goals (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  currency text not null,
  protected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);
create index if not exists goals_trip_id_idx on public.goals (trip_id);

-- RLS
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.pockets enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_delete_own" on public.profiles;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = id);

-- Trips
drop policy if exists "trips_select_own" on public.trips;
drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;
drop policy if exists "trips_delete_own" on public.trips;

create policy "trips_select_own" on public.trips
  for select using (auth.uid() = user_id);
create policy "trips_insert_own" on public.trips
  for insert with check (auth.uid() = user_id);
create policy "trips_update_own" on public.trips
  for update using (auth.uid() = user_id);
create policy "trips_delete_own" on public.trips
  for delete using (auth.uid() = user_id);

-- Pockets
drop policy if exists "pockets_select_own" on public.pockets;
drop policy if exists "pockets_insert_own" on public.pockets;
drop policy if exists "pockets_update_own" on public.pockets;
drop policy if exists "pockets_delete_own" on public.pockets;

create policy "pockets_select_own" on public.pockets
  for select using (auth.uid() = user_id);
create policy "pockets_insert_own" on public.pockets
  for insert with check (auth.uid() = user_id);
create policy "pockets_update_own" on public.pockets
  for update using (auth.uid() = user_id);
create policy "pockets_delete_own" on public.pockets
  for delete using (auth.uid() = user_id);

-- Transactions
drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);
create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id);
create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

-- Goals
drop policy if exists "goals_select_own" on public.goals;
drop policy if exists "goals_insert_own" on public.goals;
drop policy if exists "goals_update_own" on public.goals;
drop policy if exists "goals_delete_own" on public.goals;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);
