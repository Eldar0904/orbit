import { useEffect, useState } from "react";
import type { Task, TaskUpdate, Member } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { PriorityBadge } from "@/components/priority-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KANBAN_COLUMNS } from "@/lib/project-constants";
import { cn } from "@/lib/utils";
import { Calendar, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

type TaskStatus = "todo" | "in_progress" | "blocked" | "done";

export function TasksKanban({ tasks, members, onStatusChange, onUpdate, onDelete }: {
  tasks: Task[]; members: Member[];
  onStatusChange: (taskId: number, status: TaskUpdate["status"]) => void;
  onUpdate: (taskId: number, data: TaskUpdate) => void;
  onDelete: (taskId: number) => void;
}) {
  const { t } = useTranslation();
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [optimisticStatuses, setOptimisticStatuses] = useState<Record<number, TaskStatus>>({});
  useEffect(() => {
    setOptimisticStatuses((current) => {
      const next = { ...current };
      let changed = false;
      tasks.forEach((task) => {
        if (next[task.id] === task.status) {
          delete next[task.id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [tasks]);
  // B2G workflow actions belong to the Process page. Keeping them out of the
  // general Kanban leaves a clean board for project-specific work.
  const visibleTasks = tasks.filter((task) => !task.title.startsWith("[B2G:")).map((task) => ({ ...task, status: optimisticStatuses[task.id] ?? task.status }));
  const changeStatus = (taskId: number, status: TaskStatus) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task || (optimisticStatuses[taskId] ?? task.status) === status) return;
    setOptimisticStatuses((current) => ({ ...current, [taskId]: status }));
    onStatusChange(taskId, status);
  };
  const moveTask = (status: TaskStatus) => {
    if (draggedTaskId !== null) changeStatus(draggedTaskId, status);
    setDraggedTaskId(null);
  };
  return <>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {KANBAN_COLUMNS.map((col) => {
        const columnTasks = visibleTasks.filter((task) => task.status === col.id);
        const isDropTarget = draggedTaskId !== null;
        return <div key={col.id} className="space-y-3">
          <div className="flex items-center gap-2 px-1"><div className={"h-2 w-2 rounded-full " + col.color} /><span className="text-sm font-semibold">{t("status." + col.id)}</span><span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">{columnTasks.length}</span></div>
          <div className={cn("min-h-[180px] space-y-2 rounded-xl border border-dashed p-2 transition-colors", isDropTarget ? "border-pine/50 bg-pine/5" : "border-transparent")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); moveTask(col.id as TaskStatus); }}>
            {columnTasks.map((task) => <KanbanCard key={task.id} task={task} onEdit={() => setEditingTask(task)} onStatusChange={changeStatus} onDelete={onDelete} onDragStart={() => setDraggedTaskId(task.id)} onDragEnd={() => setDraggedTaskId(null)} />)}
            {columnTasks.length === 0 && <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">{isDropTarget ? "Перетащите задачу сюда" : t("projectDetail.noTasksYet")}</div>}
          </div>
        </div>;
      })}
    </div>
    <TaskEditDialog task={editingTask} members={members} onOpenChange={(open) => !open && setEditingTask(null)} onSave={onUpdate} />
  </>;
}

function KanbanCard({ task, onEdit, onStatusChange, onDelete, onDragStart, onDragEnd }: {
  task: Task; onEdit: () => void;
  onStatusChange: (taskId: number, status: TaskUpdate["status"]) => void;
  onDelete: (taskId: number) => void; onDragStart: () => void; onDragEnd: () => void;
}) {
  const { t } = useTranslation();
  return <Card
    draggable
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
    onClick={onEdit}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onEdit();
      }
    }}
    role="button"
    tabIndex={0}
    className="cursor-pointer border-border/50 shadow-sm transition-colors hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:cursor-grabbing"
  >
    <CardContent className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold leading-snug">{task.title.replace(/^\[B2G:[^\]]+\]\s*/, "")}</h4>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={(event) => event.stopPropagation()}><span className="sr-only">Действия задачи</span><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><DropdownMenuItem onClick={(event) => { event.stopPropagation(); onEdit(); }}><Pencil className="mr-2 h-4 w-4" />Редактировать</DropdownMenuItem>{KANBAN_COLUMNS.map((col) => <DropdownMenuItem key={col.id} onClick={(event) => { event.stopPropagation(); onStatusChange(task.id, col.id as TaskStatus); }}>{t("status." + col.id)}</DropdownMenuItem>)}<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(event) => { event.stopPropagation(); onDelete(task.id); }}><Trash2 className="mr-2 h-4 w-4" />{t("common.delete")}</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </div>
      {task.description && <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
      <div className="flex items-center justify-between pt-1"><div className="flex items-center gap-2"><PriorityBadge priority={task.priority} />{task.dueDate && <span className="flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground"><Calendar className="h-3 w-3" />{format(new Date(task.dueDate), "MMM d")}</span>}</div><UserAvatar member={task.assignee as Member | null} className="h-6 w-6" /></div>
    </CardContent>
  </Card>;
}

function TaskEditDialog({ task, members, onOpenChange, onSave }: {
  task: Task | null; members: Member[]; onOpenChange: (open: boolean) => void;
  onSave: (taskId: number, data: TaskUpdate) => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium"); const [assigneeId, setAssigneeId] = useState("unassigned"); const [dueDate, setDueDate] = useState("");
  useEffect(() => { if (!task) return; setTitle(task.title); setDescription(task.description ?? ""); setStatus(task.status as TaskStatus); setPriority(task.priority as "low" | "medium" | "high"); setAssigneeId(task.assigneeId ? String(task.assigneeId) : "unassigned"); setDueDate(task.dueDate ? String(task.dueDate).slice(0, 10) : ""); }, [task]);
  const save = (event: React.FormEvent) => { event.preventDefault(); if (!task || !title.trim()) return; onSave(task.id, { title: title.trim(), description, status, priority, assigneeId: assigneeId === "unassigned" ? null : Number(assigneeId), dueDate: dueDate || null }); onOpenChange(false); };
  return <Dialog open={Boolean(task)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-[560px]"><form onSubmit={save}><DialogHeader><DialogTitle>Редактировать задачу</DialogTitle></DialogHeader>
    <div className="grid gap-4 py-4">
      <div className="space-y-2"><Label>Название</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus /></div>
      <div className="space-y-2"><Label>{t("projectDetail.description")}</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{t("projectDetail.status")}</Label><Select value={status} onValueChange={(value) => setStatus(value as TaskStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KANBAN_COLUMNS.map((col) => <SelectItem key={col.id} value={col.id}>{t("status." + col.id)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t("projectDetail.priority")}</Label><Select value={priority} onValueChange={(value) => setPriority(value as typeof priority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">{t("priority.low")}</SelectItem><SelectItem value="medium">{t("priority.medium")}</SelectItem><SelectItem value="high">{t("priority.high")}</SelectItem></SelectContent></Select></div></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>{t("projectDetail.assignee")}</Label><Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">{t("common.unassigned")}</SelectItem>{members.map((member) => <SelectItem key={member.id} value={String(member.id)}>{member.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>{t("projectDetail.dueDate")}</Label><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div>
    </div>
    <div className="flex justify-end gap-2 border-t pt-3"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button><Button type="submit">Сохранить изменения</Button></div>
  </form></DialogContent></Dialog>;
}
