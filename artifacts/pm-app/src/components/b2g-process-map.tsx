import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Clock3, FileText, GitBranch, ListChecks, LockKeyhole, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  B2G_LANES, B2G_STAGES, type B2GWorkflowNode, getB2GNodeTaskStatus,
  getB2GStageIndex, getB2GStageLabel,
} from "@/lib/b2g-workflow";

type TaskRef = { title: string; status: string };
type SelectedNode = B2GWorkflowNode & { lane: string };

export function B2GProcessMap({
  stage, tasks, documentCount, onOpenTasks, onOpenDocuments, onCreateWorkflowTask, onCreateStageChecklist, onAdvanceStage,
}: {
  stage: string | null | undefined;
  tasks: TaskRef[];
  documentCount: number;
  onOpenTasks: () => void;
  onOpenDocuments: () => void;
  onCreateWorkflowTask: (node: B2GWorkflowNode) => void;
  onCreateStageChecklist: (nodes: B2GWorkflowNode[]) => void;
  onAdvanceStage: () => void;
}) {
  const [selectedNodeId, setSelectedNodeId] = useState("register-opportunity");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const currentPhase = getB2GStageIndex(stage);
  const allNodes = useMemo(() => B2G_LANES.flatMap((lane) => lane.nodes.map((node) => ({ ...node, lane: lane.label }))), []);
  const selectedNode = allNodes.find((node) => node.id === selectedNodeId) ?? allNodes[0];
  const currentNodes = allNodes.filter((node) => node.phase === currentPhase && node.required);
  const currentDone = currentNodes.filter((node) => getB2GNodeTaskStatus(node.id, tasks) === "done").length;
  const activeGates = currentNodes.filter((node) => node.kind === "gate");
  const untrackedCurrentNodes = currentNodes.filter((node) => !getB2GNodeTaskStatus(node.id, tasks));
  const gatesDone = activeGates.filter((node) => getB2GNodeTaskStatus(node.id, tasks) === "done").length;
  const canAdvance = currentNodes.length > 0 && currentDone === currentNodes.length && currentPhase < B2G_STAGES.length;

  const statusFor = (node: B2GWorkflowNode) => {
    const taskStatus = getB2GNodeTaskStatus(node.id, tasks);
    if (taskStatus === "done") return "complete";
    if (taskStatus === "blocked") return "blocked";
    if (taskStatus === "in_progress") return "active";
    if (node.phase > currentPhase) return "upcoming";
    return "pending";
  };
  const StatusIcon = ({ status }: { status: ReturnType<typeof statusFor> }) => {
    if (status === "complete") return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
    if (status === "blocked") return <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-red-600" />;
    if (status === "active") return <Clock3 className="h-3.5 w-3.5 shrink-0 text-pine" />;
    return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />;
  };
  const NodeCard = ({ node }: { node: B2GWorkflowNode }) => {
    const status = statusFor(node);
    return <button type="button" title={node.title} onClick={() => setSelectedNodeId(node.id)}
      className={cn(
        "flex min-h-[58px] w-full items-start gap-1.5 rounded-md border p-2 text-left text-[11px] leading-4 transition-colors",
        status === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-950",
        status === "active" && "border-pine/40 bg-pine/10 text-pine-deep",
        status === "blocked" && "border-red-200 bg-red-50 text-red-900",
        status === "pending" && "border-slate-200 bg-white text-slate-600",
        status === "upcoming" && "border-slate-100 bg-slate-50 text-slate-400",
        selectedNodeId === node.id && "ring-2 ring-pine/35",
      )}>
      {node.kind === "gate" ? <GitBranch className="h-3.5 w-3.5 shrink-0 text-amber-600" /> : <StatusIcon status={status} />}
      <span className="line-clamp-2">{node.title}</span>
    </button>;
  };
  const selectedStatus = statusFor(selectedNode);
  const selectedTaskStatus = getB2GNodeTaskStatus(selectedNode.id, tasks);
  const isSelectedCurrent = selectedNode.phase === currentPhase;

  return <div className="space-y-5">
    <Card className="border-pine/20 bg-pine-deep text-white shadow-sm">
      <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/65">B2G · карта исполнения</p>
          <h3 className="mt-1 text-xl font-bold">{getB2GStageLabel(stage)}</h3>
          <p className="mt-1 text-sm text-white/70">Выполнено обязательных действий: {currentDone} из {currentNodes.length} · Шлюзы: {gatesDone} из {activeGates.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {untrackedCurrentNodes.length > 0 && <Button size="sm" variant="secondary" onClick={() => onCreateStageChecklist(untrackedCurrentNodes)}><ListChecks className="mr-2 h-4 w-4" />Создать чек-лист этапа</Button>}
          <div className="flex items-center gap-1.5" aria-label="Этапы проекта">
            {B2G_STAGES.map((item, index) => <div key={item.id} title={getB2GStageLabel(item.id)} className={cn("h-2.5 w-8 rounded-full", index + 1 < currentPhase ? "bg-emerald-400" : index + 1 === currentPhase ? "bg-pine-sand" : "bg-white/20")} />)}
          </div>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <div className="min-w-[1250px]">
          <div className="grid grid-cols-[205px_repeat(6,minmax(160px,1fr))] border-b border-border bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <div className="p-3">Подразделение</div>
            {B2G_STAGES.map((stageItem, index) => <div key={stageItem.id} className={cn("border-l border-border p-3 text-center", index + 1 === currentPhase && "bg-pine/5 text-pine-deep")}>{stageItem.short}. {getB2GStageLabel(stageItem.id)}</div>)}
          </div>
          {B2G_LANES.map((lane) => <div key={lane.id} className="grid grid-cols-[205px_repeat(6,minmax(160px,1fr))] border-b border-border last:border-b-0">
            <button type="button" onClick={() => setCollapsed((old) => { const next = new Set(old); next.has(lane.id) ? next.delete(lane.id) : next.add(lane.id); return next; })}
              className="flex items-center justify-between gap-2 bg-muted/30 p-3 text-left text-xs font-semibold text-pine-deep">
              <span>{lane.label}</span><ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", collapsed.has(lane.id) && "-rotate-90")} />
            </button>
            {B2G_STAGES.map((stageItem, index) => <div key={stageItem.id} className={cn("min-h-20 border-l border-border p-2", index + 1 === currentPhase && "bg-pine/5")}>
              {!collapsed.has(lane.id) && <div className="space-y-2">{lane.nodes.filter((node) => node.phase === index + 1).map((node) => <NodeCard key={node.id} node={node} />)}</div>}
            </div>)}
          </div>)}
        </div>
      </div>

      <Card className="h-fit border-border/70 shadow-sm xl:sticky xl:top-6">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{selectedNode.kind === "gate" ? "Шлюз решения" : selectedNode.kind === "control" ? "Контроль" : "Действие"}</p><h3 className="mt-1 font-bold leading-5 text-pine-deep">{selectedNode.title}</h3></div>
            <StatusIcon status={selectedStatus} />
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{selectedNode.detail}</p>
          <div className="rounded-lg bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Ответственный контур</span><p className="mt-1 font-medium">{selectedNode.lane}</p></div>
          {selectedNode.documents && selectedNode.documents.length > 0 && <div className="rounded-lg border border-border p-3 text-sm"><div className="mb-2 flex items-center gap-2 font-medium"><FileText className="h-4 w-4 text-pine" />Обязательные документы</div><p className="text-xs leading-5 text-muted-foreground">{selectedNode.documents.join(" · ")}</p></div>}
          {selectedNode.kind === "gate" && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><div className="mb-1 flex items-center gap-1.5 font-semibold"><LockKeyhole className="h-3.5 w-3.5" />Шлюз блокирует следующий этап</div>Создайте задачу решения, зафиксируйте результат и отметьте ее выполненной после утверждения.</div>}
          <div className="grid gap-2">
            {!selectedTaskStatus
              ? <Button className="justify-start" onClick={() => onCreateWorkflowTask(selectedNode)}><ListChecks className="mr-2 h-4 w-4" />Создать связанную задачу</Button>
              : <Button className="justify-start" onClick={onOpenTasks}><ListChecks className="mr-2 h-4 w-4" />{selectedTaskStatus === "done" ? "Задача выполнена" : "Открыть связанную задачу"}</Button>}
            <Button variant="outline" className="justify-start" onClick={onOpenDocuments}><FileText className="mr-2 h-4 w-4" />Документы проекта <span className="ml-auto font-mono text-muted-foreground">{documentCount}</span></Button>
          </div>
          {isSelectedCurrent && currentPhase < B2G_STAGES.length && <div className="border-t pt-4">
            <p className="mb-2 text-xs leading-5 text-muted-foreground">{canAdvance ? "Все обязательные действия текущего этапа выполнены." : "Переход станет доступен после завершения всех обязательных действий текущего этапа."}</p>
            <Button className="w-full" variant={canAdvance ? "default" : "outline"} disabled={!canAdvance} onClick={onAdvanceStage}>Перейти к следующему этапу</Button>
          </div>}
        </CardContent>
      </Card>
    </div>
  </div>;
}
