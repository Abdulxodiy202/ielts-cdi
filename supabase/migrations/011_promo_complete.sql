-- ============================================================
-- Run this in Supabase SQL Editor (once):
-- Dashboard → SQL Editor → New query → paste → Run
-- ============================================================

-- 1. Promo codes table
create table if not exists public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 100),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean default true not null,
  created_at timestamptz default now()
);

alter table public.promo_codes enable row level security;

drop policy if exists "Auth users can read active promo codes" on public.promo_codes;
create policy "Auth users can read active promo codes" on public.promo_codes
  for select using (auth.role() = 'authenticated');

-- 2. Promo code usage tracking
create table if not exists public.promo_code_usage (
  id uuid default gen_random_uuid() primary key,
  promo_code_id uuid references public.promo_codes(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  user_name text,
  user_email text,
  original_amount integer,
  discounted_amount integer,
  used_at timestamptz default now()
);

alter table public.promo_code_usage enable row level security;

drop policy if exists "Admin can view all usage" on public.promo_code_usage;
create policy "Admin can view all usage" on public.promo_code_usage
  for select using (true);

drop policy if exists "Auth users can insert own usage" on public.promo_code_usage;
create policy "Auth users can insert own usage" on public.promo_code_usage
  for insert with check (auth.uid() = user_id);

-- 3. Add promo columns to payment_requests (safe, idempotent)
alter table public.payment_requests
  add column if not exists promo_code text,
  add column if not exists original_amount integer;
