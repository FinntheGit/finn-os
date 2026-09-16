-- FINN OS v1 schema
-- Run this in Supabase SQL Editor after creating the project.

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_on date not null default current_date,
  weight_kg numeric(5,2) not null check (weight_kg between 40 and 250),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 1 and 70),
  created_at timestamptz not null default now(),
  unique(user_id, measured_on)
);

create table if not exists public.sport_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sport_type text not null check (sport_type in ('football','padel','gym','running','swimming')),
  started_at timestamptz not null default now(),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  distance_km numeric(7,2) check (distance_km is null or distance_km >= 0),
  avg_heart_rate integer check (avg_heart_rate is null or avg_heart_rate between 30 and 240),
  perceived_effort integer check (perceived_effort is null or perceived_effort between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.gym_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.sport_sessions(id) on delete cascade,
  exercise_name text not null,
  set_number integer not null check (set_number > 0),
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(6,2) check (weight_kg is null or weight_kg >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  water_liters numeric(4,1) check (water_liters is null or water_liters between 0 and 15),
  alcohol_drinks integer check (alcohol_drinks is null or alcohol_drinks between 0 and 100),
  sport_note text,
  created_at timestamptz not null default now(),
  unique(user_id, checkin_date)
);

create table if not exists public.calendar_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  source text not null default 'finn_os' check (source in ('finn_os','icloud','work')),
  external_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  title text not null,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- All financial content goes in this vault as client-side encrypted JSON.
-- Supabase stores only ciphertext; Finn OS decrypts it in the browser after Money Lock unlock.
create table if not exists public.finance_vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('income','fixed_cost','transaction','budget','savings_goal','investment','student_debt','finance_settings')),
  payload_ciphertext text not null,
  occurred_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  target_weight_kg numeric(5,2),
  weekly_sport_target integer not null default 5 check (weekly_sport_target between 1 and 14),
  preferred_theme text not null default 'system' check (preferred_theme in ('system','light','dark')),
  monday_review_time time not null default '08:00',
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.body_measurements enable row level security;
alter table public.sport_sessions enable row level security;
alter table public.gym_sets enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.calendar_items enable row level security;
alter table public.weekly_goals enable row level security;
alter table public.finance_vault_items enable row level security;
alter table public.user_settings enable row level security;

-- Each user can only access rows whose user_id equals their authenticated uid.
do $$
declare
  t text;
begin
  foreach t in array array[
    'body_measurements','sport_sessions','gym_sets','daily_checkins',
    'calendar_items','weekly_goals','finance_vault_items','user_settings'
  ] loop
    execute format('drop policy if exists "own_rows_select" on public.%I', t);
    execute format('drop policy if exists "own_rows_insert" on public.%I', t);
    execute format('drop policy if exists "own_rows_update" on public.%I', t);
    execute format('drop policy if exists "own_rows_delete" on public.%I', t);
    execute format('create policy "own_rows_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own_rows_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists body_measurements_user_date_idx on public.body_measurements(user_id, measured_on desc);
create index if not exists sport_sessions_user_started_idx on public.sport_sessions(user_id, started_at desc);
create index if not exists finance_vault_user_type_idx on public.finance_vault_items(user_id, item_type, occurred_on desc);
create index if not exists calendar_items_user_start_idx on public.calendar_items(user_id, starts_at);
