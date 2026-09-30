import type { Project } from "@workspace/api-client-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StageStepper } from "@/components/stage-stepper";
import { formatCurrency, PROJECT_STAGES } from "@/lib/project-constants";
import { format } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";
import { MapPin, Building2, Calendar, Users } from "lucide-react";

export function OverviewTab({ project }: { project: Project }) {
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

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}
