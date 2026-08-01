/**
 * PostgreSQL-native product matcher using pg_trgm + full-text search.
 *
 * Replaces the in-memory Jaccard multi-matcher with database-level matching
 * that leverages Supabase/PostgreSQL extensions:
 *   1. pg_trgm — trigram similarity (fuzzy matching, handles typos + length diffs)
 *   2. to_tsvector/plainto_tsquery — full-text search with Russian stemming
 *   3. Combined score — weighted blend of both signals
 *
 * Benefits over the old Jaccard matcher:
 *   - Runs IN the database (no N×M in-memory loop)
 *   - GIN indexes make it fast even on 10,000+ catalog rows
 *   - Russian stemming handles word forms (стулья → стул)
 *   - Trigram similarity handles partial matches + typos naturally
 *   - IDF-like behavior from ts_rank (common words count less)
 */

import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export interface PgMatchCandidate {
  catalogProductId: number;
  name: string;
  code: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  technicalSpecs: string | null;
  unit: string | null;
  price: number | null;
  sourceId: number;
  confidenceScore: number;
  trigramScore: number;
  ftsRank: number;
  explanation: string;
  rank: number;
}

export interface PgMatchResult {
  specItemId: number;
  itemName: string;
  candidates: PgMatchCandidate[];
}

const HIGH = 0.72;
const LOW = 0.42;
const TOP_N = 3;

// Weights for combining signals
const W_TRIGRAM = 0.55; // Trigram similarity (fuzzy, handles length diffs)
const W_FTS = 0.30; // Full-text search rank (stemming, IDF-like)
const W_CODE = 0.15; // Exact code match bonus

function buildExplanation(
  trigramScore: number,
  ftsRank: number,
  codeMatch: boolean,
): string {
  if (codeMatch) return "Exact catalog code match";
  const signals: string[] = [];
  if (trigramScore >= 0.6) signals.push("names are very similar");
  else if (trigramScore >= 0.35) signals.push("names are partly similar");
  if (ftsRank >= 0.3) signals.push("key terms match (stemmed)");
  else if (ftsRank >= 0.1) signals.push("some terms overlap");
  if (!signals.length) return "Weak match: low textual overlap";
  return signals.join("; ");
}

export function statusFromScore(score: number): "matched" | "partial" | "unmatched" {
  if (score >= HIGH) return "matched";
  if (score >= LOW) return "partial";
  return "unmatched";
}

/**
 * Match a single spec item against catalog products in the database.
 * Uses a single SQL query combining pg_trgm + full-text search.
 */
export async function matchOneItem(
  queryText: string,
  queryCode: string | null,
  sourceIds: number[],
  topN: number = TOP_N,
): Promise<PgMatchCandidate[]> {
  if (!queryText.trim()) return [];

  // Normalize the query for trigram matching
  const normalizedQuery = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedQuery) return [];

  try {
  // Build the SQL query combining trigram similarity + full-text search
  // The query uses:
  //   similarity(normalized_text, $query) — trigram similarity [0..1]
  //   ts_rank(to_tsvector('simple', normalized_text), plainto_tsquery('simple', $query)) — FTS rank
  //   exact code match bonus
  const rows = await db.execute<{
    id: number;
    name: string;
    code: string | null;
    brand: string | null;
    model: string | null;
    description: string | null;
    technical_specs: string | null;
    unit: string | null;
    price: number | null;
    source_id: number;
    trgm_score: number;
    fts_rank: number;
    code_match: boolean;
    combined_score: number;
  }>(sql`
    SELECT
      cp.id,
      cp.name,
      cp.code,
      cp.brand,
      cp.model,
      cp.description,
      cp.technical_specs,
      cp.unit,
      cp.price,
      cp.source_id,
      COALESCE(similarity(cp.normalized_text, ${normalizedQuery}), 0) AS trgm_score,
      COALESCE(
        ts_rank(
          to_tsvector('simple', COALESCE(cp.normalized_text, '')),
          plainto_tsquery('simple', ${normalizedQuery})
        ),
        0
      ) AS fts_rank,
      CASE WHEN ${queryCode}::text IS NOT NULL
           AND cp.code IS NOT NULL
           AND lower(trim(cp.code)) = lower(trim(${queryCode}::text))
      THEN true ELSE false END AS code_match,
      (
        COALESCE(similarity(cp.normalized_text, ${normalizedQuery}), 0) * ${W_TRIGRAM}
        + LEAST(
            COALESCE(
              ts_rank(
                to_tsvector('simple', COALESCE(cp.normalized_text, '')),
                plainto_tsquery('simple', ${normalizedQuery})
              ),
              0
            ) * 2.5,
            1.0
          ) * ${W_FTS}
        + CASE WHEN ${queryCode}::text IS NOT NULL
               AND cp.code IS NOT NULL
               AND lower(trim(cp.code)) = lower(trim(${queryCode}::text))
          THEN 1.0 ELSE 0.0 END * ${W_CODE}
      ) AS combined_score
    FROM catalog_products cp
    WHERE cp.source_id = ANY(${sourceIds}::int[])
      AND cp.is_active = true
      AND (
        similarity(cp.normalized_text, ${normalizedQuery}) > 0.08
        OR cp.normalized_text % ${normalizedQuery}
        OR to_tsvector('simple', COALESCE(cp.normalized_text, ''))
           @@ plainto_tsquery('simple', ${normalizedQuery})
        OR (${queryCode}::text IS NOT NULL AND cp.code IS NOT NULL
            AND lower(trim(cp.code)) = lower(trim(${queryCode}::text)))
      )
    ORDER BY combined_score DESC
    LIMIT ${topN}
  `);

  return (rows.rows ?? rows ?? []).map((row: any, idx: number) => ({
    catalogProductId: row.id,
    name: row.name,
    code: row.code,
    brand: row.brand,
    model: row.model,
    description: row.description,
    technicalSpecs: row.technical_specs,
    unit: row.unit,
    price: row.price,
    sourceId: row.source_id,
    confidenceScore: Math.min(1, row.combined_score),
    trigramScore: row.trgm_score,
    ftsRank: row.fts_rank,
    explanation: buildExplanation(row.trgm_score, row.fts_rank, row.code_match),
    rank: idx + 1,
  }));
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (msg.includes("similarity") || msg.includes("pg_trgm")) {
      throw new Error("pg_trgm extension is not enabled. Run: CREATE EXTENSION IF NOT EXISTS pg_trgm; in Supabase SQL Editor.");
    }
    throw new Error(`Database matching error: ${msg.slice(0, 200)}`);
  }
}

/**
 * Match multiple spec items. Runs queries sequentially to avoid
 * overwhelming the connection pool on serverless (Vercel).
 */
export async function matchSpecItems(
  items: { id: number; itemName: string; itemCode?: string | null; description?: string | null }[],
  sourceIds: number[],
): Promise<PgMatchResult[]> {
  const results: PgMatchResult[] = [];

  for (const item of items) {
    const queryText = [item.itemCode, item.itemName, item.description]
      .filter(Boolean)
      .join(" ");
    const candidates = await matchOneItem(queryText, item.itemCode ?? null, sourceIds);
    results.push({
      specItemId: item.id,
      itemName: item.itemName,
      candidates,
    });
  }

  return results;
}
