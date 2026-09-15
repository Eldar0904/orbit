import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ChevronDown, Circle, Clock3, FileText, ListChecks, LockKeyhole, Map, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { B2G_LANES, B2G_STAGES, getB2GStageIndex, getB2GStageLabel } from "@/lib/b2g-workflow";

type ViewMode = "current" | "full";
type WorkflowStep = (typeof B2G_LANES)[number]["steps"][number] & { lane: string };

export function B2GProcessMap({ stage, taskCount, documentCount, onOpenTasks, onOpenDocuments, onCreateTask }: {
  stage: string | null | undefined; taskCount: number; documentCount: number;
  onOpenTasks: () => void; onOpenDocuments: () => void; onCreateTask: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<ViewMode>("current");
  const [selectedStepId, setSelectedStepId] = useState("register-tender");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const currentPhase = getB2GStageIndex(stage);
  const selectedStep = useMemo<WorkflowStep>(() => {
    for (const lane of B2G_LANES) { const step = lane.steps.find((item) => item.id === selectedStepId); if (step) return { ...step, lane: t(lane.label) }; }
    const fallback = B2G_LANES[0].steps[0]; return { ...fallback, lane: t(B2G_LANES[0].label) };
  }, [selectedStepId, t]);
  const statusFor = (phase: number) => phase < currentPhase ? "complete" : phase === currentPhase ? "active" : "upcoming";
  const readiness = Number(taskCount > 0) + Number(documentCount > 0);
  const StatusIcon = ({ status }: { status: "complete" | "active" | "upcoming" }) => status === "complete" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : status === "active" ? <Clock3 className="h-4 w-4 text-pine" /> : <Circle className="h-4 w-4 text-slate-300" />;
  const Step = ({ step }: { step: (typeof B2G_LANES)[number]["steps"][number] }) => {
    const status = statusFor(step.phase);
    return <button type="button" onClick={() => setSelectedStepId(step.id)} className={cn("flex w-full items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors", status === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-950", status === "active" && "border-pine/40 bg-pine/10 text-pine-deep", status === "upcoming" && "border-slate-200 bg-white text-slate-500", selectedStepId === step.id && "ring-2 ring-pine/35")}><StatusIcon status={status} /><span>{t(step.title)}</span></button>;
  };
  const visiblePhases = view === "current" ? [currentPhase, Math.min(6, currentPhase + 1)] : B2G_STAGES.map((_, index) => index + 1);

  return <div className="space-y-5">
    <Card className="border-pine/20 bg-pine-deep text-white shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">{t("b2g.currentStage")}</p><h3 className="mt-1 text-xl font-bold">{getB2GStageLabel(stage)}</h3></div><div className="flex items-center gap-1.5">{B2G_STAGES.map((item, index) => <div key={item.id} title={t(item.label)} className={cn("h-2 w-8 rounded-full", index + 1 < currentPhase ? "bg-emerald-400" : index + 1 === currentPhase ? "bg-pine-sand" : "bg-white/20")} />)}</div></CardContent></Card>

    <div className="flex rounded-lg border bg-muted/40 p-1 w-fit"><Button size="sm" variant={view === "current" ? "default" : "ghost"} onClick={() => setView("current")}>{t("b2g.currentView")}</Button><Button size="sm" variant={view === "full" ? "default" : "ghost"} onClick={() => setView("full")}><Map className="mr-2 h-4 w-4" />{t("b2g.fullMap")}</Button></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {view === "current" && <Card className="border-pine/20 bg-pine/5"><CardContent className="p-4"><p className="text-xs font-semibold uppercase tracking-wide text-pine-deep">{t("b2g.readiness")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><p className="text-2xl font-bold text-pine-deep">{readiness}/2</p><p className="text-sm text-muted-foreground">{t("b2g.readinessHint")}</p></div><div className={cn("rounded-full px-3 py-1 text-xs font-semibold", readiness === 2 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>{readiness === 2 ? t("b2g.ready") : t("b2g.needsAction")}</div></div></CardContent></Card>}
        <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", view === "full" && "overflow-x-auto")}><div className={cn("grid border-b border-border bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground", view === "full" ? "min-w-[720px] grid-cols-[190px_repeat(6,minmax(82px,1fr))]" : "grid-cols-[170px_repeat(2,minmax(0,1fr))] ")}><div className="p-3">{t("b2g.department")}</div>{visiblePhases.map((phase) => <div key={phase} className="border-l border-border p-3 text-center">{phase}. {t(B2G_STAGES[phase - 1].label)}</div>)}</div>{B2G_LANES.map((lane) => <div key={lane.id} className={cn("grid border-b border-border last:border-b-0", view === "full" ? "min-w-[720px] grid-cols-[190px_repeat(6,minmax(82px,1fr))]" : "grid-cols-[170px_repeat(2,minmax(0,1fr))]")}><button type="button" onClick={() => setCollapsed((old) => { const next = new Set(old); next.has(lane.id) ? next.delete(lane.id) : next.add(lane.id); return next; })} className="flex items-center justify-between gap-2 bg-muted/30 p-3 text-left text-xs font-semibold text-pine-deep"><span>{t(lane.label)}</span><ChevronDown className={cn("h-4 w-4", collapsed.has(lane.id) && "-rotate-90")} /></button>{visiblePhases.map((phase) => <div key={phase} className={cn("min-h-20 border-l border-border p-2", phase === currentPhase && "bg-pine/5")}>{!collapsed.has(lane.id) && <div className="space-y-2">{lane.steps.filter((step) => step.phase === phase).map((step) => <Step key={step.id} step={step} />)}</div>}</div>)}</div>)}</div>
      </div>
      <Card className="h-fit border-border/70 shadow-sm xl:sticky xl:top-6"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("b2g.selectedStep")}</p><h3 className="mt-1 font-bold text-pine-deep">{t(selectedStep.title)}</h3></div><StatusIcon status={statusFor(selectedStep.phase)} /></div><p className="text-sm leading-6 text-muted-foreground">{t(selectedStep.detail)}</p><div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">{t("b2g.responsibleLane")}</span><p className="mt-1 font-medium">{selectedStep.lane}</p></div><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><div className="mb-1 flex items-center gap-1.5 font-semibold"><LockKeyhole className="h-3.5 w-3.5" />{t("b2g.stageControl")}</div>{t("b2g.stageControlHint")}</div><div className="grid gap-2"><Button className="justify-start" onClick={onCreateTask}><ListChecks className="mr-2 h-4 w-4" />{t("b2g.createTask")}</Button><Button variant="outline" className="justify-start" onClick={onOpenTasks}><ListChecks className="mr-2 h-4 w-4" />{t("b2g.projectTasks")} <span className="ml-auto font-mono text-muted-foreground">{taskCount}</span></Button><Button variant="outline" className="justify-start" onClick={onOpenDocuments}><FileText className="mr-2 h-4 w-4" />{t("common.documents")} <span className="ml-auto font-mono text-muted-foreground">{documentCount}</span></Button><Button variant="ghost" className="justify-start text-amber-700 hover:text-amber-800"><TriangleAlert className="mr-2 h-4 w-4" />{t("b2g.risks")}</Button></div></CardContent></Card>
    </div>
  </div>;
}
