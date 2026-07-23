import { useState } from "react";
import { useListTasks, useListProjects, useListMembers, useUpdateTask, getListTasksQueryKey, TaskUpdate } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Search, Calendar, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

export default function Tasks() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const { data: projects } = useListProjects();
  const { data: allTasks, isLoading } = useListTasks();

  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const handleStatusChange = (taskId: number, status: TaskUpdate["status"]) => {
    updateTask.mutate(
      { id: taskId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
        }
      }
    );
  };

  const filteredTasks = allTasks?.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || task.status === statusFilter;
    const matchesProject = projectFilter === "all" || task.projectId.toString() === projectFilter;
    return matchesSearch && matchesStatus && matchesProject;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("tasks.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("tasks.subtitle")}</p>
      </div>

      <Card className="border-border/50 shadow-sm p-4 flex flex-col md:flex-row gap-4 items-center bg-card">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("tasks.searchPlaceholder")}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex w-full md:w-auto gap-4">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("tasks.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allProjects")}</SelectItem>
              {projects?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t("tasks.allStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tasks.allStatus")}</SelectItem>
              <SelectItem value="todo">{t("status.todo")}</SelectItem>
              <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
              <SelectItem value="done">{t("status.done")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="p-4 flex gap-4"><Skeleton className="h-6 w-full" /></div>
            ))}
          </div>
        ) : filteredTasks && filteredTasks.length > 0 ? (
          <div className="divide-y divide-border">
            <div className="hidden md:grid grid-cols-12 gap-4 p-3 bg-muted/30 border-b border-border text-xs font-bold tracking-tight text-muted-foreground uppercase">
              <div className="col-span-5">{t("tasks.task")}</div>
              <div className="col-span-2">{t("tasks.project")}</div>
              <div className="col-span-2">{t("tasks.status")}</div>
              <div className="col-span-2">{t("tasks.assignee")}</div>
              <div className="col-span-1 text-right">{t("tasks.priority")}</div>
            </div>

            {filteredTasks.map(task => (
              <div key={task.id} className="p-4 md:p-3 hover:bg-muted/20 transition-colors group grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5 min-w-0 flex items-start gap-3">
                  <CheckSquare className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate">{task.title}</h4>
                    <div className="flex items-center gap-2 mt-1 text-xs font-mono text-muted-foreground">
                      <span>#{task.id}</span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 text-sm text-muted-foreground truncate hidden md:block">
                  {task.project ? (
                    <Link href={`/projects/${task.project.id}`} className="hover:text-primary hover:underline transition-colors flex items-center gap-2 truncate">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: task.project.color }}
                      />
                      {task.project.name}
                    </Link>
                  ) : "-"}
                </div>

                <div className="md:col-span-2 shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="focus:outline-none">
                      <div className="cursor-pointer">
                        <StatusBadge status={task.status} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, "todo")}>{t("status.todo")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, "in_progress")}>{t("status.in_progress")}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(task.id, "done")}>{t("status.done")}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="md:col-span-2 shrink-0 flex items-center gap-2">
                  <UserAvatar member={task.assignee} className="w-6 h-6" />
                  <span className="text-xs truncate hidden md:block text-muted-foreground">{task.assignee?.name || t("common.unassigned")}</span>
                </div>

                <div className="md:col-span-1 shrink-0 md:text-right flex items-center md:justify-end gap-2 md:block">
                  <span className="md:hidden text-xs text-muted-foreground uppercase font-bold">{t("tasks.priority")}:</span>
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center text-muted-foreground flex flex-col items-center">
            <CheckSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>{t("tasks.noMatch")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}
