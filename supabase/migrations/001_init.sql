-- Enable RLS on all tables
-- Run this in the Supabase SQL editor

-- =========================================
-- PROFILES TABLE
-- =========================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  beach_name text not null,
  lifeguard_id text not null,
  expo_push_token text,
  latitude double precision,
  longitude double precision,
  notify_wind boolean not null default true,
  notify_uv boolean not null default true,
  notify_precipitation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();


-- =========================================
-- ALERTS TABLE
-- =========================================
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('viento', 'uv', 'precipitacion')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.alerts enable row level security;

create policy "Users can view own alerts"
  on public.alerts for select
  using (auth.uid() = user_id);

create policy "Users can update own alerts"
  on public.alerts for update
  using (auth.uid() = user_id);

create policy "Users can insert own alerts"
  on public.alerts for insert
  with check (auth.uid() = user_id);

-- Service role (edge functions) can insert alerts for any user
create policy "Service role can insert alerts"
  on public.alerts for insert
  to service_role
  with check (true);

-- Index for faster queries
create index if not exists alerts_user_id_created_at_idx
  on public.alerts (user_id, created_at desc);
