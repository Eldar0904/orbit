import { 
  useGetProject, 
  useGetProjectProgress, 
  useListTasks, 
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListProjectDocuments,
  useCreateProjectDocument,
  getListTasksQueryKey,
  getListProjectDocumentsQueryKey,
  getGetProjectProgressQueryKey,
  getGetProjectQueryKey,
  useListMembers,
  TaskUpdate,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentsTab } from "@/components/documents-tab";
import { OverviewTab } from "@/components/overview-tab";
import { TasksKanban } from "@/components/tasks-kanban";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { ArrowLeft, Plus, CheckCircle2, FileText, LayoutGrid } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/project-constants";

export default function ProjectDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id, 10);
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const queryClient = useQueryClient();

  const { data: project, isLoading: isProjectLoading } = useGetProject(projectId);
  const { data: progress, isLoading: isProgressLoading } = useGetProjectProgress(projectId);
  const { data: tasks, isLoading: isTasksLoading } = useListTasks({ projectId });
  const { data: documents } = useListProjectDocuments(projectId);
  const { data: members } = useListMembers();
  const isB2GProject = project?.projectType?.toLowerCase() === "b2g";

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
          {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  const handleStatusChange = (taskId: number, status: TaskUpdate["status"]) => {
    handleTaskUpdate(taskId, { status });
  };

  const handleTaskUpdate = (taskId: number, data: TaskUpdate) => {
    updateTask.mutate(
      { id: taskId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
          queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        },
      },
    );
  };

  const handleDeleteTask = (taskId: number) => {
    if (!confirm(t("projectDetail.deleteConfirm"))) return;
    deleteTask.mutate(
      { id: taskId },
      {
        onSuccess: () => {
          toast({ title: t("projectDetail.taskDeleted") });
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
          queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        },
      },
    );
  };

  const budget = project.budget ?? 0;
  const spent = project.budgetSpent ?? 0;
  const budgetLeft = budget > 0 ? budget - spent : null;
  const statusLabel = project.status === "active" ? t("common.active") : t("common.archived");

  return (
    <div className="space-y-6">
      <div>
        <Link href={isB2GProject ? "/b2g/projects" : "/projects"} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("projectDetail.backToProjects")}
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: project.color || "hsl(var(--primary))" }} />
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <div className="text-xs font-mono px-2 py-1 bg-muted rounded text-muted-foreground border">
              {statusLabel.toUpperCase()}
            </div>
            {isB2GProject && <div className="text-xs font-mono px-2 py-1 bg-pine/10 text-pine-deep rounded border border-pine/20">B2G</div>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <EditProjectDialog project={project} members={members ?? []} />
            <DeleteProjectDialog project={project} workspace={isB2GProject ? "b2g" : "b2b"} />
            <Button variant="outline" size="sm" onClick={() => setActiveTab("documents")}>
              <FileText className="w-4 h-4 mr-2" />
              {t("common.documents")}
            </Button>
            <CreateTaskDialog
              projectId={projectId}
              open={isTaskCreateOpen}
              onOpenChange={setIsTaskCreateOpen}
              members={members ?? []}
            />
          </div>
        </div>
        {(project.location || project.client) && (
          <p className="text-sm text-muted-foreground mt-2">
            {[project.location, project.client].filter(Boolean).join(" · ")}
          </p>
        )}
        {project.description && (
          <p className="text-muted-foreground mt-2 max-w-3xl">{project.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatPill
          label={t("common.progress")}
          value={isProgressLoading ? "…" : `${progress?.completionPercent ?? 0}%`}
          loading={isProgressLoading}
        />
        <StatPill label={t("common.tasks")} value={String(progress?.total ?? tasks?.length ?? 0)} />
        <StatPill label={t("common.documents")} value={String(documents?.length ?? 0)} />
        <StatPill label={t("projectDetail.budgetLeft")} value={budgetLeft != null ? formatCurrency(budgetLeft) : "—"} />
        <StatPill
          label={t("projectDetail.areaRooms")}
          value={project.area ? `${project.area} m²` : "—"}
          sub={project.rooms ? t("common.rooms", { count: project.rooms }) : undefined}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/40 border border-border/50">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="w-3.5 h-3.5" />
            {t("common.overview")}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("common.tasks")}
            {tasks && <span className="font-mono text-xs">{tasks.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="w-3.5 h-3.5" />
            {t("common.documents")}
            {documents && <span className="font-mono text-xs">{documents.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4 space-y-4">
          {progress && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{t("projectDetail.overallCompletion")}</span>
                  <span className="font-mono font-bold">{progress.completionPercent}%</span>
                </div>
                <Progress value={progress.completionPercent} className="h-2" />
              </CardContent>
            </Card>
          )}
          {isTasksLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : tasks && tasks.length > 0 ? (
            <TasksKanban tasks={tasks} members={members ?? []} onStatusChange={handleStatusChange} onUpdate={handleTaskUpdate} onDelete={handleDeleteTask} />
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-12 text-center flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h4 className="text-lg font-medium">{t("projectDetail.noTasksYet")}</h4>
                <p className="text-sm text-muted-foreground mt-1 mb-6">{t("projectDetail.noTasksHint")}</p>
                <Button onClick={() => setIsTaskCreateOpen(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  {t("projectDetail.addTask")}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab project={project} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

function StatPill({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        {loading ? (
          <Skeleton className="h-6 w-12 mt-1" />
        ) : (
          <>
            <p className="text-lg font-bold font-mono tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CreateTaskDialog({
  projectId,
  open,
  onOpenChange,
  members,
}: {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: { id: number; name: string }[];
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentLink, setDocumentLink] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");
  const [dueDate, setDueDate] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const createDocument = useCreateProjectDocument();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    createTask.mutate(
      {
        data: {
          projectId,
          title,
          description,
          status: "todo",
          priority: "medium",
          assigneeId: assigneeId === "unassigned" ? null : parseInt(assigneeId, 10),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        },
      },
      {
        onSuccess: async () => {
          const link = documentLink.trim();
          if (link) {
            try {
              await createDocument.mutateAsync({
                id: projectId,
                data: { name: "Документ к задаче: " + title.trim(), category: "other", storageKey: link, mimeType: "text/uri-list" },
              });
              queryClient.invalidateQueries({ queryKey: getListProjectDocumentsQueryKey(projectId) });
            } catch {
              toast({ variant: "destructive", title: "Задача создана, но ссылка на документ не сохранена" });
            }
          }
          toast({ title: t("projectDetail.taskCreated") });
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey({ projectId }) });
          queryClient.invalidateQueries({ queryKey: getGetProjectProgressQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setTitle("");
          setDescription("");
          setDocumentLink("");
          setAssigneeId("unassigned");
          setDueDate("");
        },
        onError: () => toast({ variant: "destructive", title: t("projectDetail.taskCreateFailed") }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          {t("projectDetail.addTask")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("projectDetail.createTask")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("projectDetail.taskTitle")}</Label>
              <Input id="title" placeholder={t("projectDetail.taskTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("projectDetail.description")}</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-link">Ссылка на документ Google Drive</Label>
              <Input id="document-link" type="url" placeholder="https://drive.google.com/..." value={documentLink} onChange={(e) => setDocumentLink(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("projectDetail.assignee")}</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger><SelectValue placeholder={t("projectDetail.selectAssignee")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">{t("common.unassigned")}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("projectDetail.dueDate")}</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!title || createTask.isPending}>
              {createTask.isPending ? t("common.saving") : t("projectDetail.saveTask")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
