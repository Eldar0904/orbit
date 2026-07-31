/** Shared text normalization for catalog products and spec items. */

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

export function normalizeForMatching(...parts: (string | null | undefined)[]): string {
  const raw = parts.filter(Boolean).join(" ");
  const cleaned = cleanText(raw);
  const unitMapped = applyUnitAliases(cleaned);
  return applySynonyms(unitMapped);
}

export function buildProductNormalizedText(product: {
  code?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  technicalSpecs?: string | null;
}): string {
  return normalizeForMatching(
    product.code,
    product.name,
    product.brand,
    product.model,
    product.description,
    product.technicalSpecs,
  );
}
