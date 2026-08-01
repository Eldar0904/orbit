# PostgreSQL-Native Matching Upgrade

Replaces the in-memory Jaccard matcher with Supabase/PostgreSQL `pg_trgm` + full-text search.

## What changed

| Before | After |
| --- | --- |
| In-memory Jaccard on char 3-grams | PostgreSQL `similarity()` (trigram) |
| No word stemming | `ts_rank()` with simple tokenizer |
| N×M loop in Node.js (slow for large catalogs) | Single SQL query per item (GIN-indexed) |
| 25-item batches to avoid Vercel timeout | Still batched from frontend, but each query is fast |
| Threshold: 0.72/0.42 | Same thresholds, better score quality |

## Setup (one-time, ~2 minutes)

### 1. Enable pg_trgm in Supabase

Go to **Supabase Dashboard → Database → Extensions** → search "pg_trgm" → Enable.

Or run in SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

```

### 2. Run the migration

Open **Supabase Dashboard → SQL Editor → New query**, paste the contents of:

```
scripts/enable-pg-matching.sql

```

This creates the GIN indexes needed for fast trigram + full-text queries.

### 3. Deploy the API

```powershell
# Rebuild and deploy (Vercel auto-deploys on push if connected)
git add .
git commit -m "feat: PostgreSQL-native product matching (pg_trgm + FTS)"
git push

```

Or for local dev:

```powershell
pnpm --filter @workspace/api-server run dev

```

## How it works

The new `pg-matcher.ts` sends a single SQL query per spec item:

```sql
SELECT
  cp.*,
  similarity(cp.normalized_text, $query) AS trgm_score,
  ts_rank(to_tsvector('simple', cp.normalized_text), plainto_tsquery('simple', $query)) AS fts_rank,
  -- Combined: 55% trigram + 30% FTS + 15% code bonus
  (similarity * 0.55 + fts_rank_scaled * 0.30 + code_match * 0.15) AS combined_score
FROM catalog_products cp
WHERE cp.source_id = ANY($sourceIds)
  AND cp.is_active = true
  AND (trigram_match OR fts_match OR code_match)
ORDER BY combined_score DESC
LIMIT 3;

```

### Score weights

| Signal | Weight | What it does |
| --- | --- | --- |
| Trigram similarity | 55% | Fuzzy match — handles typos, partial names, length diffs |
| Full-text rank | 30% | Stemmed keyword match — "стулья" finds "стул" |
| Exact code match | 15% | Bonus when catalog codes match exactly |

### Thresholds (same as before)

| Score | Status |
| --- | --- |
| ≥ 0.72 | `matched` (auto-selected) |
| 0.42 – 0.72 | `partial` (needs review) |
| < 0.42 | `unmatched` |

## Files modified

- `artifacts/api-server/src/lib/pg-matcher.ts` — **NEW** — the PostgreSQL matcher
- `artifacts/api-server/src/routes/sourcing.ts` — updated `POST /standalone-match` to use pg-matcher
- `scripts/enable-pg-matching.sql` — **NEW** — database migration

## Files kept (not deleted)

- `artifacts/api-server/src/lib/matcher.ts` — old Jaccard matcher (still used by project-level match-run)
- `artifacts/api-server/src/lib/multi-matcher.ts` — old multi-matcher (kept as fallback)

## Reverting

If something goes wrong, revert `sourcing.ts` to import from `multi-matcher.js` instead of `pg-matcher.js`. The old in-memory matcher still works without any database extensions.

## Future improvements

1. **Russian language config**: Replace `'simple'` with `'russian'` in `to_tsvector`/`plainto_tsquery` for proper Russian stemming (requires `CREATE TEXT SEARCH CONFIGURATION` or using the built-in `russian` config)
2. **Batch matching**: Send multiple items in one query using `LATERAL JOIN` for even fewer round-trips
3. **Score calibration**: Adjust `W_TRIGRAM`/`W_FTS`/`W_CODE` weights based on real matching results

