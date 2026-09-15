import type { Project } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StageStepper } from "@/components/stage-stepper";
import { formatCurrency, PROJECT_STAGES } from "@/lib/project-constants";
import { B2G_STAGES, getB2GStageIndex, getB2GStageLabel } from "@/lib/b2g-workflow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";
import { MapPin, Building2, Calendar, Users } from "lucide-react";

export function OverviewTab({ project }: { project: Project }) {
  if (project.projectType?.toLowerCase() === "b2g") return <B2GOverview project={project} />;

  const { t } = useTranslation();
  const budget = project.budget ?? 0;
  const spent = project.budgetSpent ?? 0;
  const budgetPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const statusLabel = project.status === "active" ? t("common.active") : t("common.archived");
  const kindLabel = project.kind ? t(`kinds.${project.kind}`, { defaultValue: project.kind }) : "—";
  const stageLabel = project.stage ? t(`stages.${project.stage}`) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">{t("projectDetail.projectPassport")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label={t("projects.type")} value={project.projectType ?? "—"} />
              <Field label={t("projectDetail.kind")} value={kindLabel} />
              <Field label={t("common.stage")} value={stageLabel} />
              <Field label={t("projectDetail.status")} value={statusLabel} />
              <Field label={t("projects.location")} value={project.location ?? "—"} icon={<MapPin className="w-3 h-3" />} />
              <Field label={t("projects.client")} value={project.client ?? "—"} icon={<Building2 className="w-3 h-3" />} />
              <Field
                label={t("projectDetail.schedule")}
                value={
                  project.startDate || project.endDate
                    ? `${project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "—"} → ${project.endDate ? format(new Date(project.endDate), "MMM d, yyyy") : "—"}`
                    : "—"
                }
                icon={<Calendar className="w-3 h-3" />}
              />
              <Field label={t("projectDetail.floors")} value={project.floors != null ? String(project.floors) : "—"} />
            </dl>
            {project.note && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">{t("projectDetail.notes")}</p>
                <p className="text-sm text-muted-foreground">{project.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">{t("projectDetail.stagePipeline")}</h3>
            <StageStepper stage={project.stage} />
            <div className="space-y-2 pt-2">
              {PROJECT_STAGES.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 text-sm ${project.stage === s.id ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="font-mono text-xs w-6">{s.short}</span>
                  <span>{t(`stages.${s.id}`)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {budget > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-end">
              <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">{t("projectDetail.budgetUtilisation")}</h3>
              <span className="text-sm font-mono">{formatCurrency(spent)} / {formatCurrency(budget)}</span>
            </div>
            <Progress value={budgetPercent} className="h-2" />
          </CardContent>
        </Card>
      )}

      {project.managers && project.managers.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> {t("projectDetail.managers")}
            </h3>
            <div className="flex flex-wrap gap-3">
              {project.managers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 text-sm">
                  <UserAvatar member={m} className="w-7 h-7" />
                  <span>{m.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function B2GOverview({ project }: { project: Project }) {
  const { t } = useTranslation();
  const currentStage = getB2GStageIndex(project.stage);
  const budget = project.budget ?? 0;
  const spent = project.budgetSpent ?? 0;
  const budgetPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  const statusLabel = project.status === "active" ? t("common.active") : t("common.archived");
  const schedule = project.startDate || project.endDate
    ? [project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "—", project.endDate ? format(new Date(project.endDate), "MMM d, yyyy") : "—"].join(" → ")
    : "—";

  return <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="border-pine/20 shadow-sm"><CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Паспорт B2G-проекта</h3><span className="rounded border border-pine/20 bg-pine/10 px-2 py-1 text-xs font-semibold text-pine-deep">B2G</span></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Field label="Контур" value="Государственные закупки и контракты" />
          <Field label={t("projectDetail.status")} value={statusLabel} />
          <Field label={t("common.stage")} value={getB2GStageLabel(project.stage)} />
          <Field label={t("projects.client")} value={project.client ?? "—"} icon={<Building2 className="h-3 w-3" />} />
          <Field label={t("projects.location")} value={project.location ?? "—"} icon={<MapPin className="h-3 w-3" />} />
          <Field label={t("common.budget")} value={budget > 0 ? formatCurrency(budget) : "—"} />
          <Field label={t("projectDetail.schedule")} value={schedule} icon={<Calendar className="h-3 w-3" />} />
        </dl>
        {project.note && <div className="border-t border-border pt-3"><p className="mb-1 text-xs font-medium text-muted-foreground">{t("projectDetail.notes")}</p><p className="text-sm text-muted-foreground">{project.note}</p></div>}
      </CardContent></Card>

      <Card className="border-pine/20 shadow-sm"><CardContent className="space-y-4 p-5">
        <div><h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Жизненный цикл B2G</h3><p className="mt-1 text-sm text-muted-foreground">Этап изменяется через обязательные действия и шлюзы на карте процесса.</p></div>
        <div className="flex gap-1.5">{B2G_STAGES.map((stage, index) => <div key={stage.id} className={cn("h-2 flex-1 rounded-full", index + 1 < currentStage ? "bg-emerald-500" : index + 1 === currentStage ? "bg-pine" : "bg-muted")} />)}</div>
        <div className="space-y-2 pt-1">{B2G_STAGES.map((stage, index) => <div key={stage.id} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5 text-sm", index + 1 === currentStage ? "bg-pine/10 font-semibold text-pine-deep" : index + 1 < currentStage ? "text-emerald-700" : "text-muted-foreground")}><span className="w-5 font-mono text-xs">{stage.short}</span><span>{getB2GStageLabel(stage.id)}</span>{index + 1 < currentStage && <span className="ml-auto text-xs">Завершен</span>}{index + 1 === currentStage && <span className="ml-auto text-xs">Текущий</span>}</div>)}</div>
      </CardContent></Card>
    </div>
    {budget > 0 && <Card className="border-border/50 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-end justify-between"><h3 className="text-sm font-bold uppercase tracking-tight text-muted-foreground">{t("projectDetail.budgetUtilisation")}</h3><span className="font-mono text-sm">{formatCurrency(spent)} / {formatCurrency(budget)}</span></div><Progress value={budgetPercent} className="h-2" /></CardContent></Card>}
    {project.managers && project.managers.length > 0 && <Card className="border-border/50 shadow-sm"><CardContent className="p-5"><h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-muted-foreground"><Users className="h-4 w-4" />{t("projectDetail.managers")}</h3><div className="flex flex-wrap gap-3">{project.managers.map((member) => <div key={member.id} className="flex items-center gap-2 text-sm"><UserAvatar member={member} className="h-7 w-7" /><span>{member.name}</span></div>)}</div></CardContent></Card>}
  </div>;
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}
