-- Payment Requests table
create table public.payment_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  user_name text,
  user_email text,
  user_phone text,
  type text check (type in ('premium', 'mock_booking')),
  amount integer,
  receipt_url text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  meta jsonb,
  admin_note text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.payment_requests enable row level security;

create policy "Users can insert own requests" on public.payment_requests
  for insert with check (auth.uid() = user_id);

create policy "Users can view own requests" on public.payment_requests
  for select using (auth.uid() = user_id);

-- Storage bucket for receipts (run this separately in SQL editor or Storage UI)
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true);
-- create policy "Public read receipts" on storage.objects for select using (bucket_id = 'receipts');
-- create policy "Auth users upload receipts" on storage.objects for insert with check (bucket_id = 'receipts' and auth.role() = 'authenticated');
