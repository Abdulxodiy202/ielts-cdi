-- 028_articles_content.sql
--
-- Articles jadvaliga crackd.it uslubidagi hub uchun kerakli ustunlar.
-- Barcha maydonlar NULLABLE (has_test dan tashqari) -- mavjud qatorlar
-- migration'dan keyin ham bemalol yashaydi. Frontend `article.category
-- ?? deriveCategory(id)` naqshi bilan fallback qiladi.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IS NULL OR category IN ('literature','science','history','humanities')),
  ADD COLUMN IF NOT EXISTS read_time int
    CHECK (read_time IS NULL OR (read_time > 0 AND read_time <= 60)),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS has_test boolean NOT NULL DEFAULT true;

-- Category bo'yicha kelajakda filter uchun oddiy indeks.
CREATE INDEX IF NOT EXISTS articles_category_idx ON articles(category)
  WHERE category IS NOT NULL;
