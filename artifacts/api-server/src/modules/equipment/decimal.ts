/** Canonical decimal strings only. Locale parsing belongs to import review. */
export function decimalString(value: unknown, precision = 20, scale = 2): string {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) throw new Error("DECIMAL_STRING_REQUIRED");
  const [whole, fraction = ""] = value.split(".");
  const normalized = whole.replace(/^0+(?=\d)/, "");
  if (normalized.length > precision - scale || fraction.length > scale) throw new Error("DECIMAL_OUT_OF_RANGE");
  return normalized + (scale ? "." + fraction.padEnd(scale, "0") : "");
}
export function parseSourceDecimal(value: unknown, scale = 2): { value: string | null; state: "value" | "blank" | "error" | "invalid" } {
  if (value == null || value === "") return { value: null, state: "blank" };
  if (typeof value === "string" && value.startsWith("#")) return { value: null, state: "error" };
  if (typeof value !== "string" && typeof value !== "number") return { value: null, state: "invalid" };
  const raw = String(value).replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  try { return { value: decimalString(raw, 20, scale), state: "value" }; }
  catch { return { value: null, state: "invalid" }; }
}
