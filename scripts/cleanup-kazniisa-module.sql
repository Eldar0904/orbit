-- =============================================================================
-- CLEANUP: Remove the entire Import & Match / Казниса module from the database
-- Run this in Supabase SQL Editor BEFORE pushing the code changes.
-- Order: children first (FK constraints), then parents.
-- =============================================================================

-- Match results & feedback (depend on match_runs, spec_items, catalog_products)
DROP TABLE IF EXISTS commercial_offer_lines CASCADE;
DROP TABLE IF EXISTS commercial_offers CASCADE;
DROP TABLE IF EXISTS match_feedback CASCADE;
DROP TABLE IF EXISTS match_results CASCADE;
DROP TABLE IF EXISTS match_runs CASCADE;

-- Spec items & lists (depend on projects, spec_lists)
DROP TABLE IF EXISTS spec_items CASCADE;
DROP TABLE IF EXISTS spec_lists CASCADE;

-- Standalone lists (independent)
DROP TABLE IF EXISTS standalone_list_items CASCADE;
DROP TABLE IF EXISTS standalone_lists CASCADE;

-- Project-catalog links (depends on projects, catalog_sources)
DROP TABLE IF EXISTS project_catalog_links CASCADE;

-- Catalog products & versions (depend on catalog_sources)
DROP TABLE IF EXISTS catalog_products CASCADE;
DROP TABLE IF EXISTS catalog_versions CASCADE;

-- Catalog sources (depends on suppliers)
DROP TABLE IF EXISTS catalog_sources CASCADE;

-- Suppliers (top-level, no FK deps)
DROP TABLE IF EXISTS suppliers CASCADE;

-- Also drop the old project_catalogs table if it exists
DROP TABLE IF EXISTS project_catalogs CASCADE;

-- Remove indexes we created
DROP INDEX IF EXISTS idx_catalog_products_normalized_text_trgm;
DROP INDEX IF EXISTS idx_catalog_products_normalized_text_fts;

-- pg_trgm extension can stay — it doesn't hurt and we'll reuse it
-- DROP EXTENSION IF EXISTS pg_trgm;

-- =============================================================================
-- Done. All matching/catalogue tables are removed.
-- Push the code changes next.
-- =============================================================================
