-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  is_premium boolean default false,
  premium_until timestamptz,
  theme text default 'dark',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Tests
create table public.tests (
  id uuid default uuid_generate_v4() primary key,
  type text check (type in ('reading', 'listening')) not null,
  title text not null,
  description text,
  is_premium boolean default false,
  is_published boolean default true,
  order_number integer not null,
  created_at timestamptz default now()
);

alter table public.tests enable row level security;

create policy "Published tests are viewable by all authenticated users" on public.tests
  for select using (auth.role() = 'authenticated' and is_published = true);

-- Passages (for reading tests)
create table public.passages (
  id uuid default uuid_generate_v4() primary key,
  test_id uuid references public.tests(id) on delete cascade not null,
  passage_number integer not null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.passages enable row level security;

create policy "Passages viewable by authenticated users" on public.passages
  for select using (auth.role() = 'authenticated');

-- Questions
create table public.questions (
  id uuid default uuid_generate_v4() primary key,
  test_id uuid references public.tests(id) on delete cascade not null,
  passage_id uuid references public.passages(id) on delete set null,
  section_number integer,
  question_number integer not null,
  question_text text not null,
  question_type text not null,
  options jsonb,
  correct_answer text not null,
  created_at timestamptz default now()
);

alter table public.questions enable row level security;

create policy "Questions viewable by authenticated users" on public.questions
  for select using (auth.role() = 'authenticated');

-- Test Sessions
create table public.test_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  test_id uuid references public.tests(id) on delete cascade not null,
  started_at timestamptz default now(),
  completed_at timestamptz,
  time_remaining integer default 3600,
  status text check (status in ('in_progress', 'completed', 'abandoned')) default 'in_progress',
  unique(user_id, test_id, status)
);

alter table public.test_sessions enable row level security;

create policy "Users can view own sessions" on public.test_sessions
  for select using (auth.uid() = user_id);

create policy "Users can insert own sessions" on public.test_sessions
  for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions" on public.test_sessions
  for update using (auth.uid() = user_id);

-- User Answers
create table public.user_answers (
  id uuid default uuid_generate_v4() primary key,
  session_id uuid references public.test_sessions(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  user_answer text,
  is_correct boolean,
  answered_at timestamptz default now(),
  unique(session_id, question_id)
);

alter table public.user_answers enable row level security;

create policy "Users can manage own answers" on public.user_answers
  for all using (
    exists (
      select 1 from public.test_sessions
      where id = session_id and user_id = auth.uid()
    )
  );

-- Test Results
create table public.test_results (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  test_id uuid references public.tests(id) on delete cascade not null,
  session_id uuid references public.test_sessions(id) on delete cascade not null,
  raw_score integer not null,
  band_score numeric(3,1) not null,
  time_taken integer,
  completed_at timestamptz default now()
);

alter table public.test_results enable row level security;

create policy "Users can view own results" on public.test_results
  for select using (auth.uid() = user_id);

create policy "Users can insert own results" on public.test_results
  for insert with check (auth.uid() = user_id);

-- Mock Test Bookings
create table public.mock_bookings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  booking_date date not null,
  time_slot text check (time_slot in ('09:00', '13:00')) not null,
  payment_status text check (payment_status in ('pending', 'paid', 'failed')) default 'pending',
  payment_ref text,
  status text check (status in ('pending', 'confirmed', 'cancelled')) default 'pending',
  created_at timestamptz default now()
);

alter table public.mock_bookings enable row level security;

create policy "Users can manage own bookings" on public.mock_bookings
  for all using (auth.uid() = user_id);

-- Subscriptions
create table public.subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  plan text default 'premium',
  price integer not null,
  currency text default 'UZS',
  started_at timestamptz default now(),
  expires_at timestamptz not null,
  payment_ref text,
  status text check (status in ('active', 'expired', 'cancelled')) default 'active'
);

alter table public.subscriptions enable row level security;

create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

create policy "Users can insert own subscriptions" on public.subscriptions
  for insert with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed: 9 reading tests (4 free, 5 premium)
insert into public.tests (type, title, description, is_premium, order_number) values
  ('reading', 'Reading Test 1', 'Academic Reading Practice Test 1', false, 1),
  ('reading', 'Reading Test 2', 'Academic Reading Practice Test 2', false, 2),
  ('reading', 'Reading Test 3', 'Academic Reading Practice Test 3', false, 3),
  ('reading', 'Reading Test 4', 'Academic Reading Practice Test 4', false, 4),
  ('reading', 'Reading Test 5', 'Academic Reading Practice Test 5 — Premium', true, 5),
  ('reading', 'Reading Test 6', 'Academic Reading Practice Test 6 — Premium', true, 6),
  ('reading', 'Reading Test 7', 'Academic Reading Practice Test 7 — Premium', true, 7),
  ('reading', 'Reading Test 8', 'Academic Reading Practice Test 8 — Premium', true, 8),
  ('reading', 'Reading Test 9', 'Academic Reading Practice Test 9 — Premium', true, 9),
  ('listening', 'Listening Test 1', 'Academic Listening Practice Test 1', false, 1),
  ('listening', 'Listening Test 2', 'Academic Listening Practice Test 2', false, 2),
  ('listening', 'Listening Test 3', 'Academic Listening Practice Test 3', false, 3),
  ('listening', 'Listening Test 4', 'Academic Listening Practice Test 4', false, 4),
  ('listening', 'Listening Test 5', 'Academic Listening Practice Test 5 — Premium', true, 5),
  ('listening', 'Listening Test 6', 'Academic Listening Practice Test 6 — Premium', true, 6),
  ('listening', 'Listening Test 7', 'Academic Listening Practice Test 7 — Premium', true, 7),
  ('listening', 'Listening Test 8', 'Academic Listening Practice Test 8 — Premium', true, 8),
  ('listening', 'Listening Test 9', 'Academic Listening Practice Test 9 — Premium', true, 9);
