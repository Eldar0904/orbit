export const B2G_STAGES = [
  { id: "p1", label: "Тендер и заявка" },
  { id: "p2", label: "Контракт и мобилизация" },
  { id: "p3", label: "Проектирование и закупки" },
  { id: "p4", label: "Работы на объекте" },
  { id: "p5", label: "Сдача и закрытие" },
  { id: "p6", label: "Гарантия и сопровождение" },
] as const;

export type B2GStageId = (typeof B2G_STAGES)[number]["id"];

export const B2G_LANES = [
  {
    id: "commercial",
    label: "Коммерческий / Тендерный",
    steps: [
      { id: "register-tender", phase: 1, title: "Зарегистрировать тендер", detail: "Изучить документы и требования заявки." },
      { id: "prepare-bid", phase: 1, title: "Подготовить и подать заявку", detail: "Собрать, проверить и направить пакет предложения." },
    ],
  },
  {
    id: "technical",
    label: "Технический / Проектный",
    steps: [
      { id: "survey", phase: 2, title: "Провести обследование объекта", detail: "Зафиксировать исходное состояние и ограничения." },
      { id: "design", phase: 3, title: "Согласовать проект и спецификацию", detail: "Подготовить ведомости, образцы и согласование заказчика." },
      { id: "commission", phase: 5, title: "Провести испытания", detail: "Собрать результаты испытаний и исполнительный комплект." },
    ],
  },
  {
    id: "management",
    label: "Управление проектом / B2G",
    steps: [
      { id: "kickoff", phase: 2, title: "Провести kick-off и назначить RACI", detail: "Зафиксировать команду, график, риски и обязательства." },
      { id: "changes", phase: 4, title: "Управлять изменениями", detail: "Оценить влияние на сроки, стоимость и риски." },
      { id: "handover", phase: 5, title: "Координировать приёмку", detail: "Подготовить сдачу и закрыть замечания." },
    ],
  },
  {
    id: "finance",
    label: "Финансовый блок",
    steps: [
      { id: "margin", phase: 1, title: "Проверить маржу и обеспечение", detail: "Подтвердить экономику участия и финансовые риски." },
      { id: "budget", phase: 3, title: "Открыть бюджет и резерв", detail: "Зафиксировать базовый бюджет и резервирование средств." },
      { id: "payment", phase: 5, title: "Контролировать оплату и P&L", detail: "Выставить счёт, контролировать оплату и план-факт." },
    ],
  },
  {
    id: "supply",
    label: "Снабжение / Логистика",
    steps: [
      { id: "suppliers", phase: 3, title: "Выбрать поставщиков", detail: "Оценить поставщиков и согласовать условия." },
      { id: "delivery", phase: 3, title: "Заказать и принять материалы", detail: "Отслеживать поставки, приёмку и дефициты." },
    ],
  },
  {
    id: "site",
    label: "Объект / Подрядчики",
    steps: [
      { id: "mobilize", phase: 4, title: "Мобилизовать объект", detail: "Защитить зоны, подготовить доступ и площадку." },
      { id: "execute", phase: 4, title: "Выполнить пакеты работ", detail: "Вести работы, прогресс и внутреннюю приёмку." },
      { id: "defects", phase: 4, title: "Устранить дефекты", detail: "Закрыть замечания перед сдачей." },
    ],
  },
  {
    id: "quality",
    label: "Качество / ОТ и ТБ",
    steps: [
      { id: "hse", phase: 2, title: "Утвердить план ОТ и ТБ", detail: "Провести инструктаж и зафиксировать план контроля." },
      { id: "inspection", phase: 4, title: "Проверить качество работ", detail: "Проводить инспекции, испытания и вести NCR." },
    ],
  },
  {
    id: "documents",
    label: "Документооборот / Сервис",
    steps: [
      { id: "closeout", phase: 5, title: "Собрать пакет сдачи", detail: "Исполнительная документация, акты, гарантии и архив." },
      { id: "warranty", phase: 6, title: "Вести гарантийные обращения", detail: "Контролировать SLA, дефекты и эскалации партнёрам." },
    ],
  },
] as const;

export function getB2GStageIndex(stage: string | null | undefined) {
  return Math.max(1, B2G_STAGES.findIndex((item) => item.id === stage) + 1);
}

export function getB2GStageLabel(stage: string | null | undefined) {
  return B2G_STAGES.find((item) => item.id === stage)?.label ?? B2G_STAGES[0].label;
}
