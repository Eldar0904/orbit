import { Badge } from "@/components/ui/badge";

type TaskPriority = "low" | "medium" | "high";

export function PriorityBadge({ priority }: { priority: TaskPriority | string }) {
  if (priority === "low") {
    return <Badge variant="outline" className="text-slate-500 border-slate-200 font-mono text-xs">LOW</Badge>;
  }
  if (priority === "medium") {
    return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-mono text-xs">MED</Badge>;
  }
  if (priority === "high") {
    return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 font-mono text-xs">HIGH</Badge>;
  }
  return <Badge variant="outline" className="font-mono text-xs">{priority.toUpperCase()}</Badge>;
}
