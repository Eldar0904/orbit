-- =============================================================================
-- КазНИИСА Module — Create tables
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS kazniisa_versions (
  id              serial PRIMARY KEY,
  label           text NOT NULL,
  pdf_filename    text,
  is_current      boolean NOT NULL DEFAULT false,
  product_count   integer NOT NULL DEFAULT 0,
  imported_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kazniisa_products (
  id              serial PRIMARY KEY,
  version_id      integer NOT NULL REFERENCES kazniisa_versions(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  unit            text,
  cargo_class     smallint,
  weight_kg       real,
  estimated_price real,
  retail_price    real,
  description     text,
  image_url       text,
  has_detail      boolean NOT NULL DEFAULT false,
  section_code    text NOT NULL,
  section_name    text NOT NULL,
  group_code      text,
  group_name      text,
  normalized_text text,
  is_group_header boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS kazniisa_product_version_code
  ON kazniisa_products (version_id, code);

CREATE INDEX IF NOT EXISTS idx_kazniisa_normalized_trgm
  ON kazniisa_products USING gin (normalized_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_kazniisa_normalized_fts
  ON kazniisa_products USING gin (to_tsvector('simple', COALESCE(normalized_text, '')));

CREATE INDEX IF NOT EXISTS idx_kazniisa_section
  ON kazniisa_products (section_code);

CREATE INDEX IF NOT EXISTS idx_kazniisa_version
  ON kazniisa_products (version_id);

CREATE TABLE IF NOT EXISTS kazniisa_match_sessions (
  id              serial PRIMARY KEY,
  version_id      integer NOT NULL REFERENCES kazniisa_versions(id) ON DELETE CASCADE,
  filename        text NOT NULL,
  item_count      integer NOT NULL,
  matched_count   integer NOT NULL DEFAULT 0,
  review_count    integer NOT NULL DEFAULT 0,
  no_match_count  integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kazniisa_match_results (
  id              serial PRIMARY KEY,
  session_id      integer NOT NULL REFERENCES kazniisa_match_sessions(id) ON DELETE CASCADE,
  input_name      text NOT NULL,
  input_code      text,
  rank            smallint NOT NULL,
  product_id      integer REFERENCES kazniisa_products(id) ON DELETE SET NULL,
  confidence      real NOT NULL,
  status          text NOT NULL DEFAULT 'pending',
  user_decision   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Done. Tables ready for Phase 2 (PDF import).
-- =============================================================================
