import type { Project, ProjectProgress } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StageStepper } from "@/components/stage-stepper";
import {
  formatCurrency,
  getKindLabel,
  getStageLabel,
  PROJECT_STAGES,
} from "@/lib/project-constants";
import { format } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";
import { MapPin, Building2, Calendar, Users, FileText } from "lucide-react";

export function OverviewTab({
  project,
  progress,
  documentCount,
}: {
  project: Project;
  progress?: ProjectProgress;
  documentCount: number;
}) {
  const budget = project.budget ?? 0;
  const spent = project.budgetSpent ?? 0;
  const remaining = budget > 0 ? budget - spent : null;
  const budgetPercent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Progress" value={`${progress?.completionPercent ?? 0}%`} sub={`${progress?.done ?? 0}/${progress?.total ?? 0} tasks`} />
        <StatCard label="Documents" value={String(documentCount)} />
        <StatCard label="Budget left" value={remaining != null ? formatCurrency(remaining) : "—"} sub={budget > 0 ? `${budgetPercent}% used` : undefined} />
        <StatCard
          label="Area / Rooms"
          value={project.area ? `${project.area} m²` : "—"}
          sub={project.rooms ? `${project.rooms} rooms` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">Project Passport</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Field label="Type" value={project.projectType ?? "—"} />
              <Field label="Kind" value={getKindLabel(project.kind)} />
              <Field label="Stage" value={getStageLabel(project.stage)} />
              <Field label="Status" value={project.status === "active" ? "Active" : "Archived"} />
              <Field label="Location" value={project.location ?? "—"} icon={<MapPin className="w-3 h-3" />} />
              <Field label="Client" value={project.client ?? "—"} icon={<Building2 className="w-3 h-3" />} />
              <Field
                label="Schedule"
                value={
                  project.startDate || project.endDate
                    ? `${project.startDate ? format(new Date(project.startDate), "MMM d, yyyy") : "—"} → ${project.endDate ? format(new Date(project.endDate), "MMM d, yyyy") : "—"}`
                    : "—"
                }
                icon={<Calendar className="w-3 h-3" />}
              />
              <Field label="Floors" value={project.floors != null ? String(project.floors) : "—"} />
            </dl>
            {project.note && (
              <div className="pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{project.note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">Stage Pipeline</h3>
            <StageStepper stage={project.stage} />
            <div className="space-y-2 pt-2">
              {PROJECT_STAGES.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 text-sm ${project.stage === s.id ? "font-medium text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="font-mono text-xs w-6">{s.short}</span>
                  <span>{s.label}</span>
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
              <h3 className="font-bold text-sm tracking-tight uppercase text-muted-foreground">Budget Utilisation</h3>
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
              <Users className="w-4 h-4" /> Managers
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

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold font-mono tracking-tight mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
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
