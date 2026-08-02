/**
 * Catalogue category assignment — automatic, from product name + group header context.
 *
 * Uses keyword rules to assign a user-friendly category to each catalogue product.
 * The Казниса file's code structure (521-101-XXYY) already encodes categories via
 * group headers, but even without that context, the product name alone is enough
 * to categorize ~95% of items correctly.
 */

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  pattern: RegExp;
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "digital",
    label: "Цифровое оборудование",
    icon: "🖥️",
    pattern: /компьютер|монитор|ноутбук|принтер|проектор|интерактив|цифров|системный блок|моноблок|планшет|сервер|коммутатор|маршрутизатор|мфу|сканер|экран.*проек|web.?cam|laptop|printer|projector|interactive|screen/i,
  },
  {
    id: "furniture",
    label: "Мебель",
    icon: "🪑",
    pattern: /стол(?!овая)|стул|шкаф|стеллаж|парт[аы]|кресл|мебел|тумб|полк[аи]|вешалк|кровать|кроватк|диван|банкетк|скамь|гардероб|секци[яи]|витрин/i,
  },
  {
    id: "didactics",
    label: "Дидактика",
    icon: "📚",
    pattern: /дидактич|учебн|плакат|пособи|набор.*обуч|методич|демонстрац|наглядн|азбук|букв|карт[аы].*геогр|глобус|таблиц.*обуч|модель.*анатом/i,
  },
  {
    id: "sensors",
    label: "Датчики и лаборатория",
    icon: "🔬",
    pattern: /датчик|лаборатор|микроскоп|прибор|измерител|sensor|осциллограф|реактив|пробирк|колб[аы]|штатив|весы.*лаб|центрифуг|спектр/i,
  },
  {
    id: "play",
    label: "Игровое оборудование",
    icon: "🎮",
    pattern: /игров|манеж|конструктор|горк[аи]|качел|песочниц|игрушк|куклы|карусел|батут|лабиринт|домик.*игр/i,
  },
  {
    id: "music",
    label: "Музыкальное",
    icon: "🎵",
    pattern: /музык|пиани[но]|синтезатор|гитар|барабан|скрипк|флейт|бубен|металлофон|ксилофон|аккордеон|микрофон.*муз/i,
  },
  {
    id: "sport",
    label: "Спортивное",
    icon: "🏋️",
    pattern: /спорт|тренаж|мат(?:ы|ов).*гимнаст|мяч|скакалк|обруч|турник|брус[ья]|канат|велотренаж|беговая|шведск.*стенк/i,
  },
  {
    id: "medical",
    label: "Медицинское",
    icon: "🏥",
    pattern: /медиц|аптечк|термометр|тонометр|кушетк.*медиц|облучатель|бактерицид|стерилиз|ингалятор/i,
  },
  {
    id: "kitchen",
    label: "Кухонное / Столовое",
    icon: "🍽️",
    pattern: /кухон|столов|посуд|кастрюл|сковород|чайник|холодильник|плит[аы].*электр|пароконвектомат|мармит|раздач/i,
  },
  {
    id: "books",
    label: "Книги",
    icon: "📖",
    pattern: /книг[аи]|энциклопед|сказк|рассказ|хрестоматия|букварь|атлас|словарь|журнал.*детск/i,
  },
];

/**
 * Assign a category to a product based on its name and optional group context.
 */
export function categorizeProduct(
  productName: string,
  groupName?: string | null,
): { categoryId: string; categoryLabel: string; categoryIcon: string } {
  const text = `${productName} ${groupName ?? ""}`;
  for (const cat of CATEGORIES) {
    if (cat.pattern.test(text)) {
      return { categoryId: cat.id, categoryLabel: cat.label, categoryIcon: cat.icon };
    }
  }
  return { categoryId: "other", categoryLabel: "Прочее", categoryIcon: "📦" };
}

/**
 * Detect if a row is a group header (has code but no price/unit).
 * Used during catalogue upload to track the current category context.
 */
export function isGroupHeader(row: {
  code?: string | null;
  name: string;
  price?: number | null;
  unit?: string | null;
}): boolean {
  return Boolean(row.code) && row.price == null && (row.unit == null || row.unit === "");
}
