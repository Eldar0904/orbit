import { Badge } from "@/components/ui/badge";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export function StatusBadge({ status }: { status: TaskStatus | string }) {
  if (status === "todo") {
    return <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200">To Do</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200">In Progress</Badge>;
  }
  if (status === "blocked") {
    return <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200">Blocked</Badge>;
  }
  if (status === "done") {
    return <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200">Done</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}
