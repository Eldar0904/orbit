import {
  useListProjects,
  useCreateProject,
  getListProjectsQueryKey,
  type ProjectWithStats,
} from "@workspace/api-client-react";
import { useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Plus, Search, FolderClosed, ArrowRight, Building2, MapPin, Calendar } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { StageStepper } from "@/components/stage-stepper";
import { UserAvatar } from "@/components/user-avatar";
import { formatCurrency, PROJECT_STAGES } from "@/lib/project-constants";
import { B2G_STAGES } from "@/lib/b2g-workflow";

function isProjectWithStats(p: unknown): p is ProjectWithStats {
  return typeof p === "object" && p !== null && "progress" in p;
}

export default function Projects({ workspace = "b2b" }: { workspace?: "b2b" | "b2g" }) {
  const { t } = useTranslation();
  const isB2GWorkspace = workspace === "b2g";
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: projects, isLoading } = useListProjects({ withStats: true });

  const filteredProjects = projects?.filter((p) => {
    const isB2GProject = p.projectType?.toLowerCase() === "b2g";
    const belongsToWorkspace = isB2GWorkspace ? isB2GProject : !isB2GProject;
    return belongsToWorkspace && (
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
      (p.client && p.client.toLowerCase().includes(search.toLowerCase())) ||
      (p.location && p.location.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isB2GWorkspace ? "B2G-проекты" : t("projects.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{isB2GWorkspace ? "Тендеры, государственные контракты и проекты оснащения." : t("projects.subtitle")}</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("projects.searchPlaceholder")}
              className="pl-9 bg-card border-border/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <CreateProjectDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} workspace={workspace} />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project as ProjectWithStats} workspace={workspace} />
          ))}
        </div>
      ) : (
        <div className="py-20 flex flex-col items-center justify-center text-center border border-dashed rounded-lg bg-card/50">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <FolderClosed className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">{t("projects.noProjectsFound")}</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-6">
            {search ? t("projects.noSearchMatch") : t("projects.emptyState")}
          </p>
          {!search && (
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t("projects.createProject")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, workspace }: { project: ProjectWithStats; workspace: "b2b" | "b2g" }) {
  const { t } = useTranslation();
  const stats = isProjectWithStats(project) ? project : null;
  const progress = stats?.progress;
  const roleBreakdown = stats?.roleBreakdown ?? [];

  return (
    <Link href={workspace === "b2g" ? `/b2g/projects/${project.id}` : `/projects/${project.id}`}>
      <Card className="h-full shadow-sm border-border/50 hover:border-primary/50 transition-colors group cursor-pointer flex flex-col">
        <CardHeader className="p-5 pb-3">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 text-white text-xs font-bold"
                style={{ backgroundColor: project.color || "hsl(var(--primary))" }}
              >
                {project.projectType ? (
                  <Building2 className="w-4 h-4" />
                ) : (
                  project.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                {(project.location || project.client) && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                    {project.location && <><MapPin className="w-3 h-3 shrink-0" />{project.location}</>}
                    {project.location && project.client && " · "}
                    {project.client}
                  </p>
                )}
              </div>
            </div>
            <div className="text-xs font-mono px-2 py-1 bg-muted rounded text-muted-foreground shrink-0">
              {project.status === "active" ? t("common.active").toUpperCase() : t("common.archived").toUpperCase()}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-0 flex-1 flex flex-col gap-4">
          {progress !== undefined && (
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">{t("common.progress")}</span>
                <span className="font-mono font-medium">{progress.completionPercent}%</span>
              </div>
              <Progress value={progress.completionPercent} className="h-1.5" />
            </div>
          )}

          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{t("common.stage")}</p>
            {workspace === "b2g" ? (
              <p className="text-sm font-medium text-pine-deep">{B2G_STAGES.find((item) => item.id === project.stage)?.label ?? B2G_STAGES[0].label}</p>
            ) : <StageStepper stage={project.stage} compact />}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-muted/40 rounded-md p-2 border border-border/40">
              <p className="text-muted-foreground">{t("common.tasks")}</p>
              <p className="font-mono font-bold text-sm">{progress?.total ?? 0}</p>
            </div>
            <div className="bg-muted/40 rounded-md p-2 border border-border/40">
              <p className="text-muted-foreground">{t("common.done")}</p>
              <p className="font-mono font-bold text-sm">{progress?.completionPercent ?? 0}%</p>
            </div>
            <div className="bg-muted/40 rounded-md p-2 border border-border/40">
              <p className="text-muted-foreground">{t("common.budget")}</p>
              <p className="font-mono font-bold text-sm truncate">{formatCurrency(project.budget)}</p>
            </div>
            <div className="bg-muted/40 rounded-md p-2 border border-border/40">
              <p className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" />{t("common.deadline")}</p>
              <p className="font-mono font-bold text-sm truncate">
                {project.endDate ? format(new Date(project.endDate), "MMM d") : "—"}
              </p>
            </div>
          </div>

          {roleBreakdown.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">{t("projects.teamWorkload")}</p>
              <div className="flex flex-wrap gap-2">
                {roleBreakdown.slice(0, 4).map((r) => (
                  <div key={r.memberId} className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-full pl-0.5 pr-2 py-0.5">
                    <UserAvatar member={{ id: r.memberId, name: r.memberName, email: "", role: "member", createdAt: "" }} className="w-5 h-5" />
                    <span className="font-medium truncate max-w-[80px]">{r.memberName.split(" ")[0]}</span>
                    <span className="font-mono text-muted-foreground">{r.done}/{r.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-mono">
              {t("common.updated", { date: format(new Date(project.updatedAt), "MMM d, yyyy") })}
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors text-slate-400">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CreateProjectDialog({ open, onOpenChange, workspace }: { open: boolean; onOpenChange: (open: boolean) => void; workspace: "b2b" | "b2g" }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f46e5");
  const [projectType, setProjectType] = useState("");
  const [location, setLocation] = useState("");
  const [client, setClient] = useState("");
  const [stage, setStage] = useState("p1");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProject = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    createProject.mutate(
      {
        data: {
          name,
          description: description || undefined,
          color: workspace === "b2g" ? "#3B898E" : color,
          status: "active",
          projectType: workspace === "b2g" ? "B2G" : projectType || undefined,
          location: location || undefined,
          client: client || undefined,
          stage: (workspace === "b2g" ? "p1" : stage) as "p1",
        },
      },
      {
        onSuccess: () => {
          toast({ title: t("projects.createdSuccess") });
          onOpenChange(false);
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey({ withStats: true }) });
          setName("");
          setDescription("");
          setProjectType("");
          setLocation("");
          setClient("");
          setStage("p1");
        },
        onError: () => toast({ variant: "destructive", title: t("projects.createFailed") }),
      },
    );
  };

  const colors = ["#4f46e5", "#0ea5e9", "#0284c7", "#0d9488", "#16a34a", "#eab308", "#f97316", "#ef4444", "#ec4899", "#d946ef", "#a855f7", "#8b5cf6"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          {t("projects.newProject")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{workspace === "b2g" ? "Новый B2G-проект" : t("projects.createNewProject")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("projects.projectName")}</Label>
              <Input id="name" placeholder={t("projects.projectNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            {workspace !== "b2g" && <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">{t("projects.type")}</Label>
                  <Input id="type" placeholder={t("projects.typePlaceholder")} value={projectType} onChange={(e) => setProjectType(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("projects.startingStage")}</Label>
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.short} — {t(`stages.${s.id}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">{t("projects.location")}</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">{t("projects.client")}</Label>
                  <Input id="client" value={client} onChange={(e) => setClient(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("projects.descriptionOptional")}</Label>
                <Textarea id="description" placeholder={t("projects.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t("projects.projectColor")}</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {colors.map((c) => (
                    <button key={c} type="button" className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${color === c ? "scale-125 ring-2 ring-offset-2 ring-primary" : "hover:scale-110"}`} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                  ))}
                </div>
              </div>
            </>}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
            <Button type="submit" disabled={!name || createProject.isPending}>
              {createProject.isPending ? t("common.creating") : t("projects.createProject")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
