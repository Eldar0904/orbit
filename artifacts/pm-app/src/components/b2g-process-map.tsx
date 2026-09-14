import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock3, FileText, ListChecks, LockKeyhole, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { B2G_LANES, B2G_STAGES, getB2GStageIndex, getB2GStageLabel } from "@/lib/b2g-workflow";

type WorkflowStep = (typeof B2G_LANES)[number]["steps"][number] & { lane: string };

export function B2GProcessMap({
  stage,
  taskCount,
  documentCount,
  onOpenTasks,
  onOpenDocuments,
}: {
  stage: string | null | undefined;
  taskCount: number;
  documentCount: number;
  onOpenTasks: () => void;
  onOpenDocuments: () => void;
}) {
  const [selectedStepId, setSelectedStepId] = useState("kickoff");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const currentPhase = getB2GStageIndex(stage);
  const selectedStep = useMemo<WorkflowStep>(() => {
    for (const lane of B2G_LANES) {
      const step = lane.steps.find((item) => item.id === selectedStepId);
      if (step) return { ...step, lane: lane.label };
    }
    const fallback = B2G_LANES[0].steps[0];
    return { ...fallback, lane: B2G_LANES[0].label };
  }, [selectedStepId]);

  const toggleLane = (laneId: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      next.has(laneId) ? next.delete(laneId) : next.add(laneId);
      return next;
    });
  };

  const statusFor = (phase: number) => phase < currentPhase ? "complete" : phase === currentPhase ? "active" : "upcoming";
  const StatusIcon = ({ status }: { status: "complete" | "active" | "upcoming" }) => {
    if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === "active") return <Clock3 className="h-4 w-4 text-pine" />;
    return <Circle className="h-4 w-4 text-slate-300" />;
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-4">
        <Card className="border-pine/20 bg-pine-deep text-white shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">Текущий этап B2G</p>
              <h3 className="mt-1 text-xl font-bold">{getB2GStageLabel(stage)}</h3>
            </div>
            <div className="flex gap-1.5">
              {B2G_STAGES.map((item, index) => (
                <div key={item.id} title={item.label} className={cn("h-2 w-8 rounded-full", index + 1 < currentPhase ? "bg-emerald-400" : index + 1 === currentPhase ? "bg-pine-sand" : "bg-white/20")} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="grid min-w-[720px] grid-cols-[190px_repeat(6,minmax(82px,1fr))] border-b border-border bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="p-3">Подразделение</div>
            {B2G_STAGES.map((item, index) => <div key={item.id} className={cn("border-l border-border p-3 text-center", index + 1 === currentPhase && "bg-pine/10 text-pine-deep")}>{index + 1}. {item.label}</div>)}
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {B2G_LANES.map((lane) => (
                <div key={lane.id} className="grid grid-cols-[190px_repeat(6,minmax(82px,1fr))] border-b border-border last:border-b-0">
                  <button type="button" onClick={() => toggleLane(lane.id)} className="flex items-center justify-between gap-2 bg-muted/30 p-3 text-left text-xs font-semibold text-pine-deep hover:bg-muted/60">
                    <span>{lane.label}</span><ChevronDown className={cn("h-4 w-4 transition-transform", collapsed.has(lane.id) && "-rotate-90")} />
                  </button>
                  {B2G_STAGES.map((phase, phaseIndex) => {
                    const steps = lane.steps.filter((item) => item.phase === phaseIndex + 1);
                    return (
                      <div key={phase.id} className={cn("min-h-20 border-l border-border p-2", phaseIndex + 1 === currentPhase && "bg-pine/5")}>
                        {!collapsed.has(lane.id) && steps.map((step) => {
                          const status = statusFor(step.phase);
                          return <button key={step.id} type="button" onClick={() => setSelectedStepId(step.id)} className={cn("mb-2 flex w-full items-start gap-1.5 rounded-md border p-2 text-left text-[11px] leading-snug transition-colors last:mb-0", status === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-950", status === "active" && "border-pine/40 bg-pine/10 text-pine-deep shadow-sm", status === "upcoming" && "border-slate-200 bg-white text-slate-500", selectedStepId === step.id && "ring-2 ring-pine/35")}>
                            <StatusIcon status={status} /><span>{step.title}</span>
                          </button>;
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Завершено</span>
          <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-pine" />Текущий этап</span>
          <span className="flex items-center gap-1.5"><Circle className="h-4 w-4 text-slate-300" />Не начато</span>
        </div>
      </div>

      <Card className="h-fit border-border/70 shadow-sm xl:sticky xl:top-6">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Выбранный шаг</p><h3 className="mt-1 font-bold text-pine-deep">{selectedStep.title}</h3></div>
            <StatusIcon status={statusFor(selectedStep.phase)} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{selectedStep.detail}</p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Ответственный контур</span><p className="mt-1 font-medium">{selectedStep.lane}</p></div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><div className="mb-1 flex items-center gap-1.5 font-semibold"><LockKeyhole className="h-3.5 w-3.5" />Контроль этапа</div>Для перехода требуется выполнение связанных задач и обязательных документов.</div>
          <div className="grid gap-2">
            <Button variant="outline" className="justify-start" onClick={onOpenTasks}><ListChecks className="mr-2 h-4 w-4" />Задачи проекта <span className="ml-auto font-mono text-muted-foreground">{taskCount}</span></Button>
            <Button variant="outline" className="justify-start" onClick={onOpenDocuments}><FileText className="mr-2 h-4 w-4" />Документы <span className="ml-auto font-mono text-muted-foreground">{documentCount}</span></Button>
            <Button variant="ghost" className="justify-start text-amber-700 hover:text-amber-800"><TriangleAlert className="mr-2 h-4 w-4" />Риски и замечания</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
