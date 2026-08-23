-- Free bookings (/api/mock/free-book, migration 037) never went through
-- /api/payment, so no payment_requests row exists to hold the name/phone
-- the student typed into FreeBookingModal. The admin bookings/submissions
-- lists fell back to profiles.full_name (often unset) and showed
-- "Noma'lum" / "Telefon kiritilmagan" for these users even though the
-- student DID enter both. Store them directly on the booking row instead.
alter table public.mock_bookings
  add column if not exists user_name text;
alter table public.mock_bookings
  add column if not exists user_phone text;
