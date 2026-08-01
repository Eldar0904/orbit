import type { CatalogProduct } from "@workspace/db";

export interface ParsedCatalogRow {
  code?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  technicalSpecs?: string | null;
  unit?: string | null;
  price?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}

export interface ParsedSpecRow {
  itemCode?: string | null;
  itemName: string;
  description?: string | null;
  quantity?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}

function findCol(headers: string[], ...candidates: string[]): string | null {
  return (
    headers.find((h) =>
      candidates.some((c) => h.toLowerCase().includes(c.toLowerCase())),
    ) ?? null
  );
}

export function parseCatalogRows(raw: Record<string, unknown>[]): ParsedCatalogRow[] {
  if (raw.length === 0) return [];
  const headers = Object.keys(raw[0]);
  const nameCol =
    findCol(headers, "name", "наименование", "название", "товар", "позиция", "item", "product") ??
    headers[0];
  const codeCol = findCol(headers, "code", "код", "артикул", "art", "government");
  const brandCol = findCol(headers, "brand", "бренд", "марка");
  const modelCol = findCol(headers, "model", "модель");
  const descCol = findCol(headers, "description", "описание");
  const specsCol = findCol(headers, "spec", "technical", "характер", "specification");
  const unitCol = findCol(headers, "unit", "ед", "единица", "uom");
  const priceCol = findCol(headers, "price", "цена", "стоимость", "cost");
  const catCodeCol = findCol(headers, "category_code", "category", "категория");
  const catNameCol = findCol(headers, "category_name");

  return raw
    .map((row): ParsedCatalogRow | null => {
      const name = String(row[nameCol] ?? "").trim();
      if (!name) return null;
      const priceRaw = priceCol ? String(row[priceCol] ?? "") : "";
      const price = priceRaw ? parseFloat(priceRaw.replace(/[^\d.,]/g, "").replace(",", ".")) : null;
      return {
        code: codeCol ? String(row[codeCol] ?? "").trim() || null : null,
        name,
        brand: brandCol ? String(row[brandCol] ?? "").trim() || null : null,
        model: modelCol ? String(row[modelCol] ?? "").trim() || null : null,
        description: descCol ? String(row[descCol] ?? "").trim() || null : null,
        technicalSpecs: specsCol ? String(row[specsCol] ?? "").trim() || null : null,
        unit: unitCol ? String(row[unitCol] ?? "").trim() || null : null,
        price: price != null && !Number.isNaN(price) ? price : null,
        categoryCode: catCodeCol ? String(row[catCodeCol] ?? "").trim() || null : null,
        categoryName: catNameCol ? String(row[catNameCol] ?? "").trim() || null : null,
      };
    })
    .filter((x): x is ParsedCatalogRow => x !== null);
}

export function parseSpecRows(raw: Record<string, unknown>[]): ParsedSpecRow[] {
  if (raw.length === 0) return [];
  const headers = Object.keys(raw[0]);
  const nameCol = findCol(
    headers,
    "name", "item", "goods", "required", "product",
    "наименование", "название", "товар", "товары", "позиция",
    "номенклатура", "продукт", "продукция", "материал",
    "оборудование", "мебель", "предмет", "изделие", "перечень",
    "item name", "наименование товара", "потребность",
  ) ?? (() => {
    // Smart heuristic fallback: find column most likely to contain product names
    const sample = raw.slice(0, 50);
    let bestKey = headers[0];
    let bestScore = -1;
    for (const key of headers) {
      let score = 0;
      for (const row of sample) {
        const val = String(row[key] ?? "").trim();
        if (!val || val.length < 4) continue;
        if (/^\d[\d\s.,\-/]*$/.test(val)) continue;
        const len = val.length;
        const lenScore = len >= 6 && len <= 150 ? len : len > 150 ? 40 : 0;
        const hasCyrillic = /[\u0400-\u04FF]/.test(val) ? 1.3 : 1.0;
        score += lenScore * hasCyrillic;
      }
      const uniqueRatio = new Set(sample.map((r) => String(r[key] ?? "").trim())).size / sample.length;
      score *= Math.min(uniqueRatio * 1.5, 1.0);
      if (score > bestScore) { bestScore = score; bestKey = key; }
    }
    return bestKey;
  })();
  const codeCol = findCol(headers, "code", "item code", "код", "артикул");
  const descCol = findCol(headers, "description", "описание");
  const qtyCol = findCol(headers, "qty", "quantity", "кол", "количество");
  const catCodeCol = findCol(headers, "category_code", "category");
  const catNameCol = findCol(headers, "category_name", "room", "кабинет");

  return raw
    .map((row): ParsedSpecRow | null => {
      const itemName = String(row[nameCol] ?? "").trim();
      if (!itemName) return null;
      const qtyRaw = qtyCol ? String(row[qtyCol] ?? "") : "";
      const quantity = qtyRaw ? parseFloat(qtyRaw.replace(",", ".")) : null;
      return {
        itemCode: codeCol ? String(row[codeCol] ?? "").trim() || null : null,
        itemName,
        description: descCol ? String(row[descCol] ?? "").trim() || null : null,
        quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
        categoryCode: catCodeCol ? String(row[catCodeCol] ?? "").trim() || null : null,
        categoryName: catNameCol ? String(row[catNameCol] ?? "").trim() || null : null,
      };
    })
    .filter((x): x is ParsedSpecRow => x !== null);
}

export function parseSpecLines(lines: string[]): ParsedSpecRow[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((itemName) => ({ itemName }));
}

export type CatalogProductMatch = Pick<
  CatalogProduct,
  "id" | "sourceId" | "code" | "name" | "brand" | "model" | "description" | "technicalSpecs" | "unit" | "price"
>;
