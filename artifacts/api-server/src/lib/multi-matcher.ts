import { tokenizeForMatch, jaccardSets } from "./matcher.js";
import type { CatalogProductMatch } from "./kb-import.js";

export interface SpecItemForMatch {
  id: number;
  itemName: string;
  itemCode?: string | null;
  description?: string | null;
  normalizedText?: string | null;
}

export interface MatchCandidate {
  catalogProductId: number;
  product: CatalogProductMatch;
  rank: number;
  confidenceScore: number;
  explanation: string;
}

const HIGH = 0.72;
const LOW = 0.42;
const TOP_N = 3;

function ngrams(value: string, size = 3): Set<string> {
  const compact = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (compact.length <= size) return new Set(compact ? [compact] : []);
  return new Set(
    Array.from({ length: compact.length - size + 1 }, (_, i) => compact.slice(i, i + size)),
  );
}

function containment(query: Set<string>, candidate: Set<string>): number {
  if (!query.size) return 0;
  let shared = 0;
  for (const token of query) if (candidate.has(token)) shared++;
  return shared / query.size;
}

function scoreSpecToProduct(spec: SpecItemForMatch, product: CatalogProductMatch) {
  const query = [spec.itemCode, spec.itemName, spec.description].filter(Boolean).join(" ");
  const candidate = [product.code, product.name, product.brand, product.model]
    .filter(Boolean)
    .join(" ");
  const queryTokens = tokenizeForMatch(query);
  const candidateTokens = tokenizeForMatch(candidate);
  const tokenJaccard = jaccardSets(queryTokens, candidateTokens);
  const tokenCoverage = containment(queryTokens, candidateTokens);
  const charSimilarity = jaccardSets(ngrams(query), ngrams(candidate));
  const exactCode = Boolean(
    spec.itemCode &&
      product.code &&
      spec.itemCode.trim().toLowerCase() === product.code.trim().toLowerCase(),
  );
  const score = exactCode
    ? 1
    : Math.min(1, tokenCoverage * 0.5 + tokenJaccard * 0.25 + charSimilarity * 0.25);
  return { score, tokenCoverage, charSimilarity, exactCode };
}

function explain(metrics: ReturnType<typeof scoreSpecToProduct>): string {
  if (metrics.exactCode) return "Exact catalog code";
  const signals: string[] = [];
  if (metrics.tokenCoverage >= 0.8) signals.push("most specification terms match");
  else if (metrics.tokenCoverage >= 0.5) signals.push("some specification terms match");
  if (metrics.charSimilarity >= 0.65) signals.push("names are textually very similar");
  else if (metrics.charSimilarity >= 0.4) signals.push("names are partly similar");
  if (!signals.length) return "No reliable match: weak lexical overlap";
  return signals.join("; ");
}

export function matchSpecItemsToCatalog(
  specItems: SpecItemForMatch[],
  catalogProducts: CatalogProductMatch[],
): Map<number, MatchCandidate[]> {
  const results = new Map<number, MatchCandidate[]>();

  for (const spec of specItems) {
    const scored = catalogProducts
      .map((product) => ({ product, ...scoreSpecToProduct(spec, product) }))
      .filter((candidate) => candidate.score >= 0.18)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N);

    results.set(
      spec.id,
      scored.map(({ product, score, tokenCoverage, charSimilarity, exactCode }, index) => ({
        catalogProductId: product.id,
        product,
        rank: index + 1,
        confidenceScore: score,
        explanation: explain({ score, tokenCoverage, charSimilarity, exactCode }),
      })),
    );
  }

  return results;
}

export function statusFromScore(score: number): "matched" | "partial" | "unmatched" {
  if (score >= HIGH) return "matched";
  if (score >= LOW) return "partial";
  return "unmatched";
}

export { HIGH, LOW, TOP_N };
