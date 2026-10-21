import { createHash } from "node:crypto";
import { z } from "zod";
import { parseSourceDecimal } from "./decimal";

const cellValue = z.union([z.string().max(8000), z.number().finite(), z.null()]);
export const stagingSchema = z.object({
  sourceBookId: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  capturedAt: z.string().datetime({ offset: true }),
  captureMode: z.enum(["sequential", "snapshot"]),
  rows: z.array(z.object({
    sheetId: z.number().int().nonnegative().max(2147483647),
    row: z.number().int().positive().max(10000000),
    kind: z.enum(["site", "room", "requirement", "payment", "reference"]),
    values: z.record(cellValue).refine(v => Object.keys(v).length <= 60, "Too many source columns"),
  }).strict()).min(1).max(2000),
}).strict().superRefine((batch, ctx) => {
  const keys = new Set<string>();
  batch.rows.forEach((r, i) => {
    const key = `${r.sheetId}:${r.row}:${r.kind}`;
    if (keys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rows", i], message: "Duplicate source locator" });
    keys.add(key);
  });
});
export type StagingInput = z.infer<typeof stagingSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => JSON.stringify(k) + ":" + stableJson(v)).join(",") + "}";
  return JSON.stringify(value);
}
export function inspectBatch(input: StagingInput) {
  const rows = [...input.rows].sort((a, b) => a.sheetId - b.sheetId || a.row - b.row || a.kind.localeCompare(b.kind));
  const normalized = { ...input, rows };
  // Capture timestamp is provenance, not content identity. Re-reading unchanged
  // cells does not create a new set of operational candidates.
  const contentHash = createHash("sha256").update(stableJson({ sourceBookId: input.sourceBookId, rows })).digest("hex");
  const issues: { sheetId: number; row: number; field: string; code: string }[] = [];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.kind] = (counts[row.kind] ?? 0) + 1;
    for (const [field, value] of Object.entries(row.values)) {
      if (typeof value === "string" && value.startsWith("#")) issues.push({ sheetId: row.sheetId, row: row.row, field, code: "SOURCE_ERROR" });
    }
    for (const field of ["quantity", "areaM2", "amount"]) {
      if (row.values[field] != null && row.values[field] !== "") {
        const parsed = parseSourceDecimal(row.values[field], field === "quantity" ? 4 : 2);
        if (parsed.state === "invalid") issues.push({ sheetId: row.sheetId, row: row.row, field, code: "DECIMAL_REVIEW_REQUIRED" });
      }
    }
    if (row.kind === "payment") issues.push({ sheetId: row.sheetId, row: row.row, field: "evidence", code: "PAYMENT_EVIDENCE_REQUIRED" });
  }
  return { normalized, contentHash, summary: { counts, issues, rowCount: rows.length, approved: false, sourceWriteAllowed: false, captureMode: input.captureMode } };
}
