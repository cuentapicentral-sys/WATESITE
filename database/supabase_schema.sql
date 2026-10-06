-- --------------------------------------------------------
-- WasteWise – Supabase schema
-- --------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  role text not null default 'operator',
  password_hash text,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists password_hash text;
alter table public.profiles enable row level security;
alter table public.containers enable row level security;
alter table public.routes enable row level security;
alter table public.vehicles enable row level security;
alter table public.alerts enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.citizens enable row level security;
alter table public.rewards enable row level security;
alter table public.drivers enable row level security;
alter table public.citizen_incidents enable row level security;

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  zone text not null,
  latitude double precision,
  longitude double precision,
  fill_level integer not null default 0 check (fill_level between 0 and 100),
  status text not null default 'normal',
  created_at timestamptz default now()
);

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  route_code text unique not null,
  area text not null,
  eta text,
  status text not null default 'scheduled',
  created_at timestamptz default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique not null,
  type text not null,
  state text not null default 'operativo',
  load_level integer not null default 0 check (load_level between 0 and 100),
  driver_name text,
  created_at timestamptz default now()
);

alter table public.vehicles add column if not exists driver_name text;

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  severity text not null default 'medium',
  created_at timestamptz default now()
);

create table if not exists public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  container_id uuid references public.containers(id) on delete cascade,
  fill_level integer not null check (fill_level between 0 and 100),
  recorded_at timestamptz default now()
);

create table if not exists public.citizens (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  points integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid references public.citizens(id) on delete cascade,
  reward_name text not null,
  points_cost integer not null default 0,
  redeemed_at timestamptz default now()
);

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  license_number text unique not null,
  status text not null default 'available' check (status in ('available', 'assigned', 'off_duty')),
  created_at timestamptz default now()
);

create table if not exists public.recycling_donations (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid references public.citizens(id) on delete cascade,
  qr_code text not null,
  place text not null,
  photo_url text,
  points_awarded integer not null default 5,
  created_at timestamptz default now()
);

create table if not exists public.citizen_incidents (
  id uuid primary key default gen_random_uuid(),
  citizen_id uuid references public.citizens(id) on delete set null,
  category text not null,
  description text not null,
  photo_url text,
  latitude double precision,
  longitude double precision,
  status text not null default 'reported' check (status in ('reported', 'assigned', 'resolved', 'rejected')),
  created_at timestamptz default now()
);

-- Optional: example rows
drop policy if exists "demo_all_access_containers" on public.containers;
create policy "demo_all_access_containers" on public.containers
for all using (true) with check (true);

drop policy if exists "demo_all_access_routes" on public.routes;
create policy "demo_all_access_routes" on public.routes
for all using (true) with check (true);

drop policy if exists "demo_all_access_vehicles" on public.vehicles;
create policy "demo_all_access_vehicles" on public.vehicles
for all using (true) with check (true);

drop policy if exists "demo_all_access_alerts" on public.alerts;
create policy "demo_all_access_alerts" on public.alerts
for all using (true) with check (true);

drop policy if exists "demo_all_access_sensor_readings" on public.sensor_readings;
create policy "demo_all_access_sensor_readings" on public.sensor_readings
for all using (true) with check (true);

drop policy if exists "demo_all_access_citizens" on public.citizens;
create policy "demo_all_access_citizens" on public.citizens
for all using (true) with check (true);

drop policy if exists "demo_all_access_rewards" on public.rewards;
create policy "demo_all_access_rewards" on public.rewards
for all using (true) with check (true);

drop policy if exists "demo_all_access_drivers" on public.drivers;
create policy "demo_all_access_drivers" on public.drivers
for all using (true) with check (true);

drop policy if exists "demo_all_access_citizen_incidents" on public.citizen_incidents;
create policy "demo_all_access_citizen_incidents" on public.citizen_incidents
for all using (true) with check (true);

insert into public.containers (code, zone, latitude, longitude, fill_level, status)
values
  ('C-240', 'Centro', 8.7526, -75.8812, 92, 'critical'),
  ('C-155', 'Norte', 8.7784, -75.8608, 64, 'normal'),
  ('C-311', 'Sur', 8.7242, -75.8874, 88, 'critical')
on conflict (code) do nothing;

insert into public.routes (route_code, area, eta, status)
values
  ('R-204', 'Centro', '08:40', 'in_progress'),
  ('R-118', 'Norte', '09:15', 'scheduled'),
  ('R-330', 'Sur', '09:45', 'urgent')
on conflict (route_code) do nothing;

insert into public.alerts (title, description, severity)
values
  ('Contenedor crítico', 'El contenedor C-240 supera el 90% de llenado.', 'high'),
  ('Ruta reprogramada', 'La ruta R-330 fue reprogramada por tráfico.', 'medium')
on conflict do nothing;
