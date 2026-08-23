-- 037_mock_schedule_price.sql
--
-- Lets the admin set a per-schedule price for a Mock Test session
-- instead of the hardcoded 20,000 UZS everywhere. price = 0 marks the
-- session as free, which the app uses to skip the payment-receipt
-- flow entirely (see /api/mock/free-book).

alter table public.mock_schedules
  add column if not exists price integer not null default 20000;

alter table public.mock_schedules
  drop constraint if exists mock_schedules_price_nonnegative;
alter table public.mock_schedules
  add constraint mock_schedules_price_nonnegative
  check (price >= 0);
