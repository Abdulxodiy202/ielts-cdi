-- Books bilingual recommendations.
--
-- Adds recommendation_uz and recommendation_en columns to `books` so admins
-- can supply the pitch in both languages. Existing single-language content
-- is backfilled into recommendation_uz (site default was O'zbek), leaving
-- recommendation_en NULL — the API/UI falls back to _uz when _en is empty.
--
-- The original `recommendation` column is KEPT so pre-migration reads
-- don't break; new code writes to _uz/_en and the fallback logic ignores
-- the legacy column once both new fields are populated.

alter table books
  add column if not exists recommendation_uz text,
  add column if not exists recommendation_en text;

-- Backfill: if _uz is empty but the legacy column has content, copy it in.
-- Idempotent — running again won't clobber admin edits.
update books
set recommendation_uz = recommendation
where recommendation_uz is null
  and recommendation is not null
  and length(trim(recommendation)) > 0;
