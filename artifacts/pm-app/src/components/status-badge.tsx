import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export function StatusBadge({ status }: { status: TaskStatus | string }) {
  const { t } = useTranslation();

  if (status === "todo") {
    return <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">{t("status.todo")}</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">{t("status.in_progress")}</Badge>;
  }
  if (status === "blocked") {
    return <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">{t("status.blocked")}</Badge>;
  }
  if (status === "done") {
    return <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">{t("status.done")}</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
