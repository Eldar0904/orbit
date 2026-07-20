/**
 * Item matching engine — deterministic TF-IDF + Jaccard similarity.
 * Ported from compare-tools.js in the B2B-projects repo.
 *
 * Pipeline:
 *   1. Normalize text (lowercase, strip punctuation, unit aliases)
 *   2. Apply synonym aliases
 *   3. Char 3-grams + word 1-grams + word 2-grams
 *   4. Jaccard similarity
 *   5. Threshold: ≥0.55 matched, 0.30–0.55 partial, <0.30 unmatched
 */

export interface CatalogItemRow {
  name: string;
  code?: string | null;
  unit?: string | null;
  price?: number | null;
}

export interface MatchResult {
  input: string;
  matched: string | null;
  score: number;
  status: "matched" | "partial" | "unmatched";
  catalogItem: CatalogItemRow | null;
}

// ─── Normalization ────────────────────────────────────────────────────────────

const UNIT_ALIASES: Record<string, string> = {
  кг: "kg", килограмм: "kg", килограмма: "kg", килограммов: "kg",
  г: "g", грамм: "g", грамма: "g",
  м: "m", метр: "m", метра: "m", метров: "m",
  см: "cm", сантиметр: "cm", сантиметра: "cm",
  мм: "mm", миллиметр: "mm",
  шт: "pcs", штук: "pcs", штука: "pcs", штуки: "pcs",
  комп: "set", комплект: "set", комплекта: "set", набор: "set",
  л: "l", литр: "l", литра: "l", литров: "l",
  мл: "ml",
  рул: "roll", рулон: "roll",
  уп: "pack", упак: "pack", упаковка: "pack",
};

// Synonym pairs — both directions are applied
const SYNONYM_PAIRS: [string, string][] = [
  ["парта", "стол"],
  ["доска", "панель"],
  ["кресло", "стул"],
  ["шкаф", "стеллаж"],
  ["лампа", "светильник"],
  ["ноутбук", "laptop"],
  ["компьютер", "computer"],
  ["принтер", "printer"],
  ["проектор", "projector"],
  ["экран", "screen"],
];

function cleanText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applyUnitAliases(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => UNIT_ALIASES[w] ?? w)
    .join(" ");
}

function applySynonyms(text: string): string {
  let result = text;
  for (const [a, b] of SYNONYM_PAIRS) {
    result = result.replace(new RegExp(`\\b${a}\\b`, "g"), `${a} ${b}`);
    result = result.replace(new RegExp(`\\b${b}\\b`, "g"), `${a} ${b}`);
  }
  return result;
}

function normalize(raw: string): string {
  const cleaned = cleanText(raw);
  const unitMapped = applyUnitAliases(cleaned);
  return applySynonyms(unitMapped);
}

// ─── N-gram helpers ───────────────────────────────────────────────────────────

function charNgrams(s: string, n: number): Set<string> {
  const grams = new Set<string>();
  const pad = "_".repeat(n - 1);
  const padded = `${pad}${s}${pad}`;
  for (let i = 0; i <= padded.length - n; i++) {
    grams.add(padded.slice(i, i + n));
  }
  return grams;
}

function wordNgrams(s: string, n: number): Set<string> {
  const words = s.split(/\s+/).filter(Boolean);
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    grams.add(words.slice(i, i + n).join(" "));
  }
  return grams;
}

function tokenize(raw: string): Set<string> {
  const norm = normalize(raw);
  return new Set([
    ...charNgrams(norm, 3),
    ...wordNgrams(norm, 1),
    ...wordNgrams(norm, 2),
  ]);
}

// ─── Jaccard similarity ───────────────────────────────────────────────────────

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const tok of a) if (b.has(tok)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function similarity(a: string, b: string): number {
  return jaccard(tokenize(a), tokenize(b));
}

// ─── Public API ───────────────────────────────────────────────────────────────

const HIGH = 0.55;
const LOW = 0.30;

export function matchItems(
  specItems: string[],
  catalogItems: CatalogItemRow[]
): MatchResult[] {
  // Pre-tokenize catalog for efficiency
  const catalogTokens = catalogItems.map((c) => ({
    item: c,
    tokens: tokenize(c.name),
  }));

  return specItems.map((raw) => {
    const specTokens = tokenize(raw);
    let bestScore = 0;
    let bestCatalogItem: CatalogItemRow | null = null;

    for (const { item, tokens } of catalogTokens) {
      const score = jaccard(specTokens, tokens);
      if (score > bestScore) {
        bestScore = score;
        bestCatalogItem = item;
      }
    }

    const status: MatchResult["status"] =
      bestScore >= HIGH ? "matched" : bestScore >= LOW ? "partial" : "unmatched";

    return {
      input: raw,
      matched: bestScore >= LOW ? (bestCatalogItem?.name ?? null) : null,
      score: Math.round(bestScore * 100),
      status,
      catalogItem: bestScore >= LOW ? bestCatalogItem : null,
    };
  });
}
