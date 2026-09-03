-- Landing sahifasidagi "mahsulot isboti" (product proof) skrinshotlar
-- galereyasi -- admin panelidan boshqariladi ("Sayt rasmlari" bo'limi),
-- kirish sahifasida (/ -- login qilinmagan foydalanuvchilar ko'radigan
-- sahifa) animatsiyali kartalar galereyasi sifatida chiqadi.
--
-- Run in Supabase Dashboard -> SQL Editor before deploying (migrations
-- are not automated). Idempotent.

CREATE TABLE IF NOT EXISTS landing_showcase_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,                    -- ixtiyoriy tagsarlavha, masalan "Reading test interfeysi"
  image_url TEXT NOT NULL,       -- public storage URL
  storage_path TEXT NOT NULL,    -- 'landing' bucket ichidagi yo'l -- o'chirishda kerak
  order_index INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_landing_showcase_order ON landing_showcase_images(order_index);

ALTER TABLE landing_showcase_images ENABLE ROW LEVEL SECURITY;

-- Kirish sahifasi RLS-aware (anon) client bilan o'qiydi -- faqat
-- nashr etilganlar hammaga ko'rinadi. Yozish faqat admin API'dan,
-- service-role orqali (RLS'ni chetlab o'tadi).
DROP POLICY IF EXISTS "read published showcase images" ON landing_showcase_images;
CREATE POLICY "read published showcase images" ON landing_showcase_images
  FOR SELECT USING (is_published = true);

-- Storage bucket -- rasm fayllari shu yerda, public o'qish bilan
-- (galereya har qanday tashrif buyuruvchiga, hatto tizimga
-- kirmagan mehmonga ham ko'rinishi kerak).
INSERT INTO storage.buckets (id, name, public)
VALUES ('landing', 'landing', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read landing" ON storage.objects;
CREATE POLICY "Public read landing"
ON storage.objects FOR SELECT
USING (bucket_id = 'landing');
