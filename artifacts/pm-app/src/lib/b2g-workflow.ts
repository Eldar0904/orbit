import i18n from "@/i18n";

export const B2G_STAGES = [
  { id: "p1", label: "b2g.stages.p1" }, { id: "p2", label: "b2g.stages.p2" },
  { id: "p3", label: "b2g.stages.p3" }, { id: "p4", label: "b2g.stages.p4" },
  { id: "p5", label: "b2g.stages.p5" }, { id: "p6", label: "b2g.stages.p6" },
] as const;

export type B2GStageId = (typeof B2G_STAGES)[number]["id"];

export const B2G_LANES = [
  {
    id: "commercial",
    label: "b2g.lanes.commercial",
    steps: [
      { id: "register-tender", phase: 1, title: "b2g.steps.registerTender.title", detail: "b2g.steps.registerTender.detail" },
      { id: "prepare-bid", phase: 1, title: "b2g.steps.prepareBid.title", detail: "b2g.steps.prepareBid.detail" },
    ],
  },
  {
    id: "technical",
    label: "b2g.lanes.technical",
    steps: [
      { id: "survey", phase: 2, title: "b2g.steps.survey.title", detail: "b2g.steps.survey.detail" },
      { id: "design", phase: 3, title: "b2g.steps.design.title", detail: "b2g.steps.design.detail" },
      { id: "commission", phase: 5, title: "b2g.steps.commission.title", detail: "b2g.steps.commission.detail" },
    ],
  },
  {
    id: "management",
    label: "b2g.lanes.management",
    steps: [
      { id: "kickoff", phase: 2, title: "b2g.steps.kickoff.title", detail: "b2g.steps.kickoff.detail" },
      { id: "changes", phase: 4, title: "b2g.steps.changes.title", detail: "b2g.steps.changes.detail" },
      { id: "handover", phase: 5, title: "b2g.steps.handover.title", detail: "b2g.steps.handover.detail" },
    ],
  },
  {
    id: "finance",
    label: "b2g.lanes.finance",
    steps: [
      { id: "margin", phase: 1, title: "b2g.steps.margin.title", detail: "b2g.steps.margin.detail" },
      { id: "budget", phase: 3, title: "b2g.steps.budget.title", detail: "b2g.steps.budget.detail" },
      { id: "payment", phase: 5, title: "b2g.steps.payment.title", detail: "b2g.steps.payment.detail" },
    ],
  },
  {
    id: "supply",
    label: "b2g.lanes.supply",
    steps: [
      { id: "suppliers", phase: 3, title: "b2g.steps.suppliers.title", detail: "b2g.steps.suppliers.detail" },
      { id: "delivery", phase: 3, title: "b2g.steps.delivery.title", detail: "b2g.steps.delivery.detail" },
    ],
  },
  {
    id: "site",
    label: "b2g.lanes.site",
    steps: [
      { id: "mobilize", phase: 4, title: "b2g.steps.mobilize.title", detail: "b2g.steps.mobilize.detail" },
      { id: "execute", phase: 4, title: "b2g.steps.execute.title", detail: "b2g.steps.execute.detail" },
      { id: "defects", phase: 4, title: "b2g.steps.defects.title", detail: "b2g.steps.defects.detail" },
    ],
  },
  {
    id: "quality",
    label: "b2g.lanes.quality",
    steps: [
      { id: "hse", phase: 2, title: "b2g.steps.hse.title", detail: "b2g.steps.hse.detail" },
      { id: "inspection", phase: 4, title: "b2g.steps.inspection.title", detail: "b2g.steps.inspection.detail" },
    ],
  },
  {
    id: "documents",
    label: "b2g.lanes.documents",
    steps: [
      { id: "closeout", phase: 5, title: "b2g.steps.closeout.title", detail: "b2g.steps.closeout.detail" },
      { id: "warranty", phase: 6, title: "b2g.steps.warranty.title", detail: "b2g.steps.warranty.detail" },
    ],
  },
] as const;

export function getB2GStageIndex(stage: string | null | undefined) {
  return Math.max(1, B2G_STAGES.findIndex((item) => item.id === stage) + 1);
}

export function getB2GStageLabel(stage: string | null | undefined) {
  return i18n.t(B2G_STAGES.find((item) => item.id === stage)?.label ?? B2G_STAGES[0].label);
}
