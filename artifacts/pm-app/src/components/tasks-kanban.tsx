import type { Task, TaskUpdate, Member } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { KANBAN_COLUMNS } from "@/lib/project-constants";
import { Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export function TasksKanban({
  tasks,
  onStatusChange,
  onDelete,
}: {
  tasks: Task[];
  onStatusChange: (taskId: number, status: TaskUpdate["status"]) => void;
  onDelete: (taskId: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.id);
        return (
          <div key={col.id} className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold">{col.label}</span>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-2 min-h-[120px]">
              {columnTasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                />
              ))}
              {columnTasks.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onStatusChange: (taskId: number, status: TaskUpdate["status"]) => void;
  onDelete: (taskId: number) => void;
}) {
  return (
    <Card className="border-border/50 shadow-sm hover:border-primary/30 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-snug">{task.title}</h4>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
                <span className="sr-only">Move task</span>
                <StatusBadge status={task.status} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {KANBAN_COLUMNS.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  onClick={() => onStatusChange(task.id, col.id as TaskStatus)}
                >
                  {col.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={task.priority} />
            {task.dueDate && (
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {format(new Date(task.dueDate), "MMM d")}
              </span>
            )}
          </div>
          <UserAvatar member={task.assignee as Member | null} className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}
