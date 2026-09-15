import i18n from "@/i18n";

/**
 * The BPMN model is represented as operational data, not as a static drawing.
 * Tasks created from a node use a stable marker so their status drives the map.
 */
export const B2G_TASK_MARKER = "[B2G:";

export const B2G_STAGES = [
  { id: "p1", label: "b2g.stages.p1", short: "01" },
  { id: "p2", label: "b2g.stages.p2", short: "02" },
  { id: "p3", label: "b2g.stages.p3", short: "03" },
  { id: "p4", label: "b2g.stages.p4", short: "04" },
  { id: "p5", label: "b2g.stages.p5", short: "05" },
  { id: "p6", label: "b2g.stages.p6", short: "06" },
] as const;

export type B2GStageId = (typeof B2G_STAGES)[number]["id"];
export type B2GNodeKind = "activity" | "gate" | "control";
export type B2GWorkflowNode = {
  id: string; phase: number; title: string; detail: string; kind?: B2GNodeKind;
  required?: boolean; documents?: string[];
};
export type B2GLane = { id: string; label: string; nodes: B2GWorkflowNode[] };

const activity = (id: string, phase: number, title: string, detail: string, documents: string[] = []): B2GWorkflowNode => ({ id, phase, title, detail, documents, required: true });
const control = (id: string, phase: number, title: string, detail: string): B2GWorkflowNode => ({ id, phase, title, detail, kind: "control", required: true });
const gate = (id: string, phase: number, title: string, detail: string): B2GWorkflowNode => ({ id, phase, title, detail, kind: "gate", required: true });

/** Complete operational inventory transcribed from the supplied BPMN 2.0 maps. */
export const B2G_LANES: B2GLane[] = [
  { id: "customer", label: "Заказчик / Портал закупок", nodes: [
    activity("tender-published", 1, "Опубликован тендер / лид", "Получить приглашение или извещение, зафиксировать источник и срок."),
    activity("customer-approve-design", 3, "Проверить и утвердить проект / образцы", "Получить подтверждение заказчика по проекту, спецификации и образцам.", ["Согласование заказчика"]),
    activity("customer-inspect", 5, "Проверить работы и выдать перечень замечаний", "Организовать осмотр и зафиксировать замечания до приемки."),
    gate("customer-accept", 5, "Приемка на портале подписана?", "Подтверждение приемки в портале является обязательным условием закрытия."),
  ] },
  { id: "commercial", label: "Коммерческий / Тендерный", nodes: [
    activity("register-opportunity", 1, "Зарегистрировать возможность и скачать документы", "Создать карточку тендера, сохранить извещение, ТЗ и сроки.", ["Извещение", "Тендерная документация"]),
    activity("qualify-bid", 1, "Квалифицировать возможность", "Проверить требования, сроки, риски и соответствие профилю компании."),
    activity("prepare-bid", 1, "Собрать и проверить пакет заявки", "Сформировать коммерческую часть и комплект приложений."),
    activity("submit-bid", 1, "Подать заявку через портал", "Подать заявку или направить предложение с подтверждением отправки."),
    activity("record-outcome", 1, "Зафиксировать результат тендера", "Обновить базу: победа, отказ или причина проигрыша."),
    activity("contract-handover", 2, "Передать контракт, ТЗ, смету и обязательства", "Передать проектной команде согласованный комплект для запуска.", ["Контракт", "ТЗ", "Смета"]),
  ] },
  { id: "technical", label: "Технический / Проектный", nodes: [
    activity("technical-review", 1, "Проверить техническую спецификацию и ограничения", "Проверить применимость решений, объемы и ограничения объекта."),
    activity("cost-estimate", 1, "Подготовить концепцию, ведомость объемов и смету", "Подготовить техническую и расчетную основу заявки.", ["Ведомость объемов", "Смета"]),
    activity("site-survey", 2, "Провести обследование объекта", "Зафиксировать исходное состояние, фото и ограничения объекта.", ["Отчет обследования", "Фотофиксация"]),
    activity("design-package", 3, "Разработать и согласовать проект и ведомость", "Подготовить рабочее решение, спецификацию и материалы согласования.", ["Проект", "Спецификация"]),
    activity("commissioning", 5, "Провести испытания, пусконаладку и сборы", "Выполнить испытания и подготовить технические подтверждения приемки."),
  ] },
  { id: "management", label: "Управление проектом / B2G", nodes: [
    activity("kickoff-raci", 2, "Провести kick-off, назначить RACI и задачи", "Согласовать команду, роли, график коммуникаций и план запуска.", ["RACI", "Протокол kick-off"]),
    control("project-risk-plan", 2, "Сформировать планы рисков, качества, ОТ и ТБ", "Зафиксировать риски, контрольные точки, эскалации и коммуникации."),
    activity("change-control", 4, "Обновить график, стоимость, риски и план", "Оформить изменение и подготовить его к решению."),
    gate("change-decision", 4, "Есть изменения проекта?", "При наличии изменения требуется утверждение срока и стоимости; без него продолжается базовый план."),
    gate("ready-for-handover", 4, "Работы готовы к сдаче?", "Передать на закрытие можно только после внутренних проверок."),
  ] },
  { id: "legal", label: "Юридический отдел", nodes: [
    activity("legal-tender-review", 1, "Проверить условия, риски и соответствие требованиям", "Проверить тендерные условия, гарантии, санкции и обязательные требования."),
    activity("supplier-contracts", 3, "Проверить и заключить договоры с поставщиками", "Проверить договорные обязательства поставщиков и субподрядчиков.", ["Договор поставки"]),
  ] },
  { id: "finance", label: "Финансовый блок", nodes: [
    activity("bid-margin", 1, "Проверить маржу, денежный поток и обеспечение", "Подтвердить финансовую модель, лимиты и требуемое обеспечение."),
    gate("participation-decision", 1, "Участвовать в тендере?", "Решение руководства: участвовать или архивировать возможность."),
    activity("budget-reserve", 3, "Открыть бюджет и зарезервировать средства", "Зафиксировать базовый бюджет, резерв и финансовые лимиты."),
    activity("forecast-update", 4, "Обновить бюджет и прогноз", "Отразить утвержденные изменения, риски поставки и прогноз."),
    activity("invoice-payment", 5, "Выставить счет и контролировать оплату", "Сформировать счет, отслеживать оплату и закрывающие документы.", ["Счет", "Акт"]),
    activity("pl-analysis", 5, "Выполнить P&L и анализ план-факт", "Зафиксировать финансовый результат проекта."),
  ] },
  { id: "supply", label: "Снабжение / Логистика", nodes: [
    activity("supplier-selection", 3, "Найти и оценить поставщиков / субподрядчиков", "Выбрать поставщика по цене, сроку, качеству и риску."),
    activity("order-receive", 3, "Заказать, отследить, принять и проверить материалы", "Заказать материалы, контролировать доставку и приемку.", ["Заказ", "Накладная"]),
    control("supply-recovery", 4, "Ускорить поставку дефицитных или заменяемых материалов", "Управлять риском поставки и согласованными заменами."),
  ] },
  { id: "site", label: "Объект / Подрядчики", nodes: [
    activity("site-handover", 4, "Принять объект", "Подтвердить передачу объекта и готовность к началу работ."),
    activity("site-mobilize", 4, "Мобилизовать объект и защитить зоны школы", "Организовать площадку, доступы, защиту зон и подрядчиков."),
    activity("work-packages", 4, "Выполнить пакеты работ по оснащению", "Выполнять работы согласно утвержденному проекту и графику."),
    activity("internal-check", 4, "Завершить работы и провести внутреннюю проверку", "Подтвердить готовность к предъявлению заказчику."),
    activity("correct-punch-list", 5, "Устранить замечания и провести повторную проверку", "Закрыть замечания приемки с подтверждающими материалами."),
  ] },
  { id: "quality", label: "Качество / ОТ и ТБ", nodes: [
    control("hse-briefing", 4, "Провести инструктаж, утвердить ППР и план ОТ и ТБ", "До мобилизации подтвердить правила безопасности и план работ."),
    activity("inspection-test", 4, "Проверить работы и зафиксировать данные", "Провести инспекции, испытания и оформить результаты."),
    gate("conformity-gate", 4, "Работы соответствуют требованиям?", "При несоответствии открыть дефект / NCR и вернуть на устранение."),
    activity("ncr-resolution", 4, "Устранить дефект / несоответствие", "Закрыть NCR с повторной проверкой качества."),
  ] },
  { id: "education", label: "Обучение", nodes: [
    activity("training", 5, "Провести обучение и сертификацию пользователей", "Обучить пользователей, собрать подтверждения и сертификаты.", ["Протокол обучения"]),
  ] },
  { id: "documents", label: "Документооборот", nodes: [
    activity("closeout-package", 5, "Собрать АВР, счета, гарантию и пакет для приемки", "Сформировать полный комплект исполнительной и закрывающей документации.", ["АВР", "Исполнительная документация", "Гарантия"]),
    activity("archive-lessons", 6, "Архивировать документы, гарантию и извлеченные уроки", "Передать полный архив и зафиксировать опыт проекта."),
  ] },
  { id: "service", label: "Сервис / Сопровождение", nodes: [
    activity("warranty-register", 6, "Зарегистрировать гарантию, дефекты и обращения", "Запустить сопровождение: сроки реакции, эскалации и отчетность."),
    activity("warranty-close", 6, "Закрыть гарантийные обращения", "Подтвердить устранение дефектов и закрытие сервисных обязательств."),
  ] },
  { id: "executive", label: "CEO / Управляющий директор", nodes: [
    gate("baseline-approval", 3, "Утвердить базовый план и крупные обязательства", "Утвердить бюджет, сроки, ключевые обязательства и пороги полномочий."),
    gate("change-approval", 4, "Утвердить изменение срока и стоимости", "Подтвердить изменение, если оно превышает согласованные пороги."),
    gate("project-close", 6, "Проект закрыт?", "Подтвердить завершение обязательств, архивацию и передачу в сервис."),
  ] },
];

export function getB2GStageIndex(stage: string | null | undefined) {
  return Math.max(1, B2G_STAGES.findIndex((item) => item.id === stage) + 1);
}
export function getB2GStageLabel(stage: string | null | undefined) {
  return i18n.t(B2G_STAGES.find((item) => item.id === stage)?.label ?? B2G_STAGES[0].label);
}
export function getB2GTaskTitle(node: B2GWorkflowNode) {
  return B2G_TASK_MARKER + node.id + "] " + node.title;
}
export function getB2GNodeTaskStatus(nodeId: string, tasks: Array<{ title: string; status: string }>) {
  return tasks.find((item) => item.title.startsWith(B2G_TASK_MARKER + nodeId + "]"))?.status ?? null;
}
