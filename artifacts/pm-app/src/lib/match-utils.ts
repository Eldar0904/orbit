/** Client-side match status thresholds (mirror server multi-matcher). */
export function statusFromScore(score: number): "matched" | "partial" | "unmatched" {
  if (score >= 0.55) return "matched";
  if (score >= 0.3) return "partial";
  return "unmatched";
}
