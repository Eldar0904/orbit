import { 
  useGetProject, 
  useGetProjectProgress, 
  useListTasks, 
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getListTasksQueryKey,
  getGetProjectProgressQueryKey,
  useListMembers,
  TaskUpdate
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { UserAvatar } from "@/components/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Plus, Calendar, Clock, CheckCircle2, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id, 10);
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId);
  const { data: progress, isLoading: isProgressLoading } = useGetProjectProgress(projectId);
  const { data: tasks, isLoading: isTasksLoading } = useListTasks({ projectId });
  const { data: members } = useListMembers();

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { toast } = useToast();

  if (isProjectLoading || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-4 gap-4 mt-8">
          <Skeleton className="h-24 w-full col-span-4 lg:col-span-1" />
          <Skeleton className="h-96 w-full col-span-4 lg:col-span-3" />
        </div>
      </div>
    );
  }

  const handleStatusChange = (taskId: number, status: TaskUpdate["status"]) => {
    updateTask.mutate(
      { id: taskId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
          queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
        }
      }
    );
  };

  const handleDeleteTask = (taskId: number) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    deleteTask.mutate(
      { id: taskId },
      {
        onSuccess: () => {
          toast({ title: "Task deleted" });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
          queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
        }
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <Link href="/projects" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-4 h-4 rounded-sm" 
              style={{ backgroundColor: project.color || 'hsl(var(--primary))' }} 
            />
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="text-xs font-mono px-2 py-1 bg-muted rounded text-muted-foreground border">
              {project.status.toUpperCase()}
            </div>
          </div>
          <CreateTaskDialog 
            projectId={projectId} 
            open={isTaskCreateOpen} 
            onOpenChange={setIsTaskCreateOpen} 
            members={members || []} 
          />
        </div>
        {project.description && (
          <p className="text-muted-foreground mt-2 max-w-3xl">{project.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Progress Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <h3 className="font-bold text-sm tracking-tight mb-4 uppercase text-muted-foreground">Progress</h3>
              
              {isProgressLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : progress ? (
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-3xl font-bold font-mono tracking-tight">{progress.completionPercent.toFixed(0)}%</span>
                      <span className="text-sm text-muted-foreground">Completed</span>
                    </div>
                    <Progress value={progress.completionPercent} className="h-2" />
                  </div>
                  
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-slate-200" />
                        <span className="text-muted-foreground">To Do</span>
                      </div>
                      <span className="font-mono font-medium">{progress.todo}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">In Progress</span>
                      </div>
                      <span className="font-mono font-medium">{progress.inProgress}</span>
                    </div>
                    <div className="flex justify-between text-sm items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Done</span>
                      </div>
                      <span className="font-mono font-medium">{progress.done}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-border flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Tasks</span>
                    <span className="font-mono font-bold">{progress.total}</span>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <div className="lg:col-span-3">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="bg-muted/30 px-5 py-3 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-sm tracking-tight">TASKS ({tasks?.length || 0})</h3>
            </div>
            
            {isTasksLoading ? (
              <div className="divide-y divide-border">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4 flex gap-4"><Skeleton className="h-6 w-full" /></div>
                ))}
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="divide-y divide-border">
                {tasks.map(task => (
                  <div key={task.id} className="p-4 hover:bg-muted/20 transition-colors group flex flex-col sm:flex-row gap-4 sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-base mb-1 truncate">{task.title}</h4>
                        <div className="flex sm:hidden gap-2">
                          <PriorityBadge priority={task.priority} />
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mb-2 max-w-2xl">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border border-slate-200">#{task.id}</span>
                        {task.dueDate && (
                          <div className="flex items-center gap-1 font-mono">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(task.dueDate), "MMM d")}
                          </div>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated {format(new Date(task.updatedAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 mt-3 sm:mt-0">
                      <div className="hidden sm:block">
                        <PriorityBadge priority={task.priority} />
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <UserAvatar member={task.assignee} className="w-7 h-7" />
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger className="focus:outline-none">
                            <div className="cursor-pointer">
                              <StatusBadge status={task.status} />
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, "todo")}>To Do</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, "in_progress")}>In Progress</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(task.id, "done")}>Done</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                <span className="sr-only">Open menu</span>
                                <div className="flex gap-0.5">
                                  <div className="w-1 h-1 rounded-full bg-current" />
                                  <div className="w-1 h-1 rounded-full bg-current" />
                                  <div className="w-1 h-1 rounded-full bg-current" />
                                </div>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDeleteTask(task.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h4 className="text-lg font-medium">No tasks yet</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-6">Create the first task to get this project moving.</p>
                <Button onClick={() => setIsTaskCreateOpen(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function CreateTaskDialog({ 
  projectId, 
  open, 
  onOpenChange,
  members
}: { 
  projectId: number, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  members: any[]
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    createTask.mutate({
      data: { 
        projectId, 
        title, 
        description, 
        status, 
        priority,
        assigneeId: assigneeId === "unassigned" ? null : parseInt(assigneeId, 10),
        dueDate: dueDate ? new Date(dueDate).toISOString() : null
      }
    }, {
      onSuccess: () => {
        toast({ title: "Task created" });
        onOpenChange(false);
        queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
        queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
        // Reset form
        setTitle("");
        setDescription("");
        setStatus("todo");
        setPriority("medium");
        setAssigneeId("unassigned");
        setDueDate("");
      },
      onError: () => {
        toast({ variant: "destructive", title: "Failed to create task" });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title</Label>
              <Input 
                id="title" 
                placeholder="e.g. Design landing page hero section" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="Add context, acceptance criteria, etc." 
                value={description} 
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members?.map(m => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input 
                  type="date" 
                  value={dueDate} 
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!title || createTask.isPending}>
              {createTask.isPending ? "Saving..." : "Save Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
