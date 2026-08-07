-- Promo codes table
create table public.promo_codes (
  id uuid default gen_random_uuid() primary key,
  code text not null unique,
  discount_percent integer not null check (discount_percent between 1 and 100),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean default true not null,
  created_at timestamptz default now()
);

alter table public.promo_codes enable row level security;

-- Admin reads/writes via service role (no user-facing RLS needed for writes)
-- Users can only validate (via API route using admin client)
create policy "Auth users can read active promo codes" on public.promo_codes
  for select using (auth.role() = 'authenticated');

-- Add promo tracking columns to payment_requests
alter table public.payment_requests
  add column if not exists promo_code text,
  add column if not exists original_amount integer;
