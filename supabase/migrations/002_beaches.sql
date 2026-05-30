-- =========================================
-- BEACHES TABLE
-- =========================================
create table if not exists public.beaches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  municipality text not null,
  latitude double precision not null,
  longitude double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.beaches enable row level security;

create policy "Todos pueden ver playas activas"
  on public.beaches for select
  using (is_active = true);

create policy "Solo admins pueden insertar playas"
  on public.beaches for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "Solo admins pueden actualizar playas"
  on public.beaches for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- =========================================
-- UPDATE PROFILES TABLE
-- =========================================
alter table public.profiles
  add column if not exists beach_id uuid references public.beaches(id),
  add column if not exists is_admin boolean not null default false;

-- =========================================
-- SAMPLE BEACHES — Provincia de Buenos Aires
-- =========================================
insert into public.beaches (name, municipality, latitude, longitude) values
  ('Playa Bristol',        'Mar del Plata',          -38.0023, -57.5575),
  ('Playa Grande',         'Mar del Plata',          -38.0280, -57.5490),
  ('Playa Varese',         'Mar del Plata',          -38.0150, -57.5530),
  ('Playa de Miramar',     'Miramar',                -38.2714, -57.8364),
  ('Playa de Necochea',    'Necochea',               -38.5551, -58.7393),
  ('Playa de Pinamar',     'Pinamar',                -37.1107, -56.8614),
  ('Playa de Villa Gesell','Villa Gesell',           -37.2578, -56.9743),
  ('Playa de Mar de Ajó',  'Mar de Ajó',             -36.7333, -56.6833),
  ('Playa Santa Teresita', 'Santa Teresita',         -36.5436, -56.7002),
  ('Playa San Bernardo',   'San Bernardo',           -36.6833, -56.7167),
  ('Playa San Clemente',   'San Clemente del Tuyú',  -36.3667, -56.7167),
  ('Playa Las Toninas',    'Las Toninas',            -36.4500, -56.6833),
  ('Playa Monte Hermoso',  'Monte Hermoso',          -38.9833, -61.2833),
  ('Playa Claromecó',      'Claromecó',              -38.8500, -60.0667),
  ('Playa de Pehuen-Có',   'Pehuen-Có',              -39.0167, -61.5500);
