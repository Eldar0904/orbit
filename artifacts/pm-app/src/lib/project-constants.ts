export const PROJECT_STAGES = [
  { id: "p1", label: "Type Definition", short: "P1" },
  { id: "p2", label: "Item List Formation", short: "P2" },
  { id: "p3", label: "Spec & Estimate", short: "P3" },
  { id: "p4", label: "Delivery & Install", short: "P4" },
  { id: "p5", label: "Financial Close", short: "P5" },
  { id: "p6", label: "Subscriptions & Post-Service", short: "P6" },
] as const;

export type ProjectStageId = (typeof PROJECT_STAGES)[number]["id"];

export const PROJECT_KINDS = [
  { id: "akr", label: "AKR" },
  { id: "ep", label: "EP" },
  { id: "no_plan", label: "No Plan" },
] as const;

export const DOCUMENT_CATEGORIES = [
  { id: "specification", label: "Specification" },
  { id: "contract", label: "Contract" },
  { id: "floor_plan", label: "Floor Plan" },
  { id: "invoice", label: "Invoice" },
  { id: "permit", label: "Permit" },
  { id: "photo", label: "Photo" },
  { id: "procurement", label: "Procurement" },
  { id: "act", label: "Act" },
  { id: "other", label: "Other" },
] as const;

export const KANBAN_COLUMNS = [
  { id: "todo", label: "To Do", color: "bg-slate-200" },
  { id: "in_progress", label: "In Progress", color: "bg-blue-500" },
  { id: "blocked", label: "Blocked", color: "bg-amber-500" },
  { id: "done", label: "Done", color: "bg-green-500" },
] as const;

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "—";
  const locale = i18n.language === "kk" ? "kk-KZ" : i18n.language === "ru" ? "ru-RU" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function getStageLabel(stage: string | null | undefined): string {
  return stage ? i18n.t(`stages.${stage}`) : "P1";
}

export function getKindLabel(kind: string | null | undefined): string {
  if (!kind) return "—";
  return i18n.t(`kinds.${kind}`, { defaultValue: kind });
}

export function getDocumentCategoryLabel(category: string): string {
  return i18n.t(`documentCategories.${category}`, { defaultValue: category });
}
import i18n from "@/i18n";
