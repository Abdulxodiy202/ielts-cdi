-- Add referral_code to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text unique;

-- Referral tracking table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references profiles(id) on delete cascade,
  referred_id uuid references profiles(id) on delete cascade,
  referred_email text,
  referred_name text,
  created_at timestamptz default now(),
  converted_to_premium boolean default false,
  converted_at timestamptz
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own referrals" ON referrals;
DROP POLICY IF EXISTS "Anyone can insert referral" ON referrals;
CREATE POLICY "Users see own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Anyone can insert referral" ON referrals FOR INSERT WITH CHECK (true);

-- Add referral_code column to payment_requests
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS referral_code text;
