-- Run in Supabase Dashboard -> SQL Editor before deploying (migrations
-- are not automated). Idempotent.
--
-- Foydalanuvchi o'z hisobini o'chirganda (nima uchun o'chirayotgani va
-- ixtiyoriy izohi) shu jadvalga yoziladi -- admin panelda ko'rish uchun.
--
-- user_id'ga ATAYLAB FK qo'yilmagan (ON DELETE CASCADE bilan): bu yozuv
-- aynan auth.users qatori o'chirilgandan KEYIN ham saqlanib qolishi
-- kerak, aks holda "kim, nima uchun o'chirgani" haqidagi ma'lumot
-- foydalanuvchi bilan birga yo'qolib ketardi.
CREATE TABLE IF NOT EXISTS account_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_name TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

-- Hech qanday public/authenticated policy YO'Q (default deny) --
-- faqat SERVICE ROLE (server tomonidagi createAdminClient()) orqali
-- yoziladi (hisob o'chirilayotganda) va o'qiladi (admin panel).
