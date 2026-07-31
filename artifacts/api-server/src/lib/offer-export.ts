import type { SpecItem, MatchResultRow, CatalogProduct } from "@workspace/db";

export interface OfferLineInput {
  specItem: SpecItem;
  result: MatchResultRow | null;
  product: CatalogProduct | null;
  marginPercent: number;
}

export interface OfferLine {
  lineNumber: number;
  itemName: string;
  matchedName: string;
  quantity: number | null;
  unit: string;
  unitPrice: number | null;
  lineTotal: number | null;
}

export function buildOfferLines(
  inputs: OfferLineInput[],
): { lines: OfferLine[]; totalAmount: number } {
  let totalAmount = 0;
  const lines: OfferLine[] = inputs.map((input, idx) => {
    const quantity = input.specItem.quantity ?? null;
    const unit = input.product?.unit ?? "";
    const basePrice = input.result?.matchedPrice ?? input.product?.price ?? null;
    const unitPrice =
      basePrice != null ? Math.round(basePrice * (1 + input.marginPercent / 100) * 100) / 100 : null;
    const lineTotal =
      unitPrice != null && quantity != null
        ? Math.round(unitPrice * quantity * 100) / 100
        : unitPrice;
    if (lineTotal != null) totalAmount += lineTotal;

    return {
      lineNumber: idx + 1,
      itemName: input.specItem.itemName,
      matchedName: input.result?.matchedName ?? input.product?.name ?? "",
      quantity,
      unit,
      unitPrice,
      lineTotal,
    };
  });

  return { lines, totalAmount: Math.round(totalAmount * 100) / 100 };
}

/** Build CSV content for Offer export (Excel-compatible). */
export function buildOfferCsv(
  projectName: string,
  lines: OfferLine[],
  totalAmount: number,
): string {
  const header = ["#", "Spec Item", "Matched Product", "Qty", "Unit", "Unit Price", "Line Total"];
  const rows = lines.map((l) => [
    l.lineNumber,
    `"${l.itemName.replace(/"/g, '""')}"`,
    `"${l.matchedName.replace(/"/g, '""')}"`,
    l.quantity ?? "",
    l.unit,
    l.unitPrice ?? "",
    l.lineTotal ?? "",
  ]);
  const csv = [
    `"Commercial Offer — ${projectName.replace(/"/g, '""')}"`,
    "",
    header.join(","),
    ...rows.map((r) => r.join(",")),
    "",
    `"Total",,,,,,${totalAmount}`,
  ].join("\n");
  return csv;
}
