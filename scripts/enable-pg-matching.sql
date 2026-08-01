-- =============================================================================
-- Orbit: Enable PostgreSQL-native product matching
-- Run this once in your Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- Step 1: Enable pg_trgm extension (trigram similarity)
-- This powers fuzzy matching: handles typos, partial names, length differences
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Set a lower trigram similarity threshold (default 0.3 is too strict)
-- This allows the % operator to return more candidates for reranking
ALTER DATABASE postgres SET pg_trgm.similarity_threshold = 0.08;

-- Step 3: Create GIN index for trigram similarity on normalized_text
-- This makes similarity() and the % operator index-accelerated
CREATE INDEX IF NOT EXISTS idx_catalog_products_normalized_text_trgm
  ON catalog_products
  USING gin (normalized_text gin_trgm_ops);

-- Step 4: Create GIN index for full-text search on normalized_text
-- This powers ts_rank and the @@ operator with stemming
CREATE INDEX IF NOT EXISTS idx_catalog_products_normalized_text_fts
  ON catalog_products
  USING gin (to_tsvector('simple', COALESCE(normalized_text, '')));

-- Step 5: Ensure normalized_text is populated for existing rows
-- (Should already be filled by the import process, but just in case)
UPDATE catalog_products
SET normalized_text = lower(
  regexp_replace(
    COALESCE(code, '') || ' ' ||
    COALESCE(name, '') || ' ' ||
    COALESCE(brand, '') || ' ' ||
    COALESCE(model, '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE(technical_specs, ''),
    '[^\w\s]', ' ', 'g'
  )
)
WHERE normalized_text IS NULL;

-- Step 6: Verify it works (test query — replace with a real product name)
-- Uncomment and run manually to test:
--
-- SELECT
--   name,
--   similarity(normalized_text, 'стол детский') AS trgm_score,
--   ts_rank(
--     to_tsvector('simple', COALESCE(normalized_text, '')),
--     plainto_tsquery('simple', 'стол детский')
--   ) AS fts_rank
-- FROM catalog_products
-- WHERE normalized_text % 'стол детский'
--    OR to_tsvector('simple', COALESCE(normalized_text, ''))
--       @@ plainto_tsquery('simple', 'стол детский')
-- ORDER BY trgm_score DESC
-- LIMIT 5;

-- =============================================================================
-- Done! The pg-matcher.ts module in the API server will now use these indexes.
-- =============================================================================
