import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

type TaskPriority = "low" | "medium" | "high";

export function PriorityBadge({ priority }: { priority: TaskPriority | string }) {
  const { t } = useTranslation();

  if (priority === "low") {
    return <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono text-xs">{t("priority.low").toUpperCase()}</Badge>;
  }
  if (priority === "medium") {
    return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-mono text-xs">{t("priority.medium").slice(0, 3).toUpperCase()}</Badge>;
  }
  if (priority === "high") {
    return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 font-mono text-xs">{t("priority.high").toUpperCase()}</Badge>;
  }
  return <Badge variant="outline" className="font-mono text-xs">{priority.toUpperCase()}</Badge>;
}
