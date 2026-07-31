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
  const nameCol =
    findCol(headers, "name", "item", "goods", "required", "description", "наименование", "название", "позиция", "item name") ?? headers[0];
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
