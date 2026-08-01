# Plan: Catalogue Category System

## Goal

Auto-categorize Казниса catalogue products into user-friendly groups like:
🖥️ Digital Equipment, 🪑 Furniture, 📚 Didactics, 🔬 Sensors/Lab, etc.

## How the Казниса file is structured

The file already has a **hierarchical code system** with built-in grouping:

```
Row types in the file:
  1. Section header  → "Отдел 52. Технологическое оборудование"
                        (only column A filled, no code, no price)
  2. Group header    → Code: 521-101-0100, Name: "Оборудования игровое"
                        (has code + name, but NO unit and NO price)
  3. Real product    → Code: 521-101-0401-0059, Name: "Системный блок Lenovo..."
                        (has code + name + unit + price → actual item)
```

### Code structure:
```
521-101-XXYY-ZZZZ
         ^^
         └─ This 2-digit group determines the category
```

## Implementation Plan

### Step 1: Extract categories from group headers during import

When uploading the Казниса file, detect group header rows (rows with a code
but NO price/unit) and store them as category definitions:

```typescript
// During Excel parsing:
if (hasCode && !hasPrice && !hasUnit) {
  // This is a group header → defines a category
  currentCategory = { code: row.code, name: row.name };
} else if (hasCode && hasPrice) {
  // This is a real product → assign the current category
  product.categoryCode = currentCategory.code;
  product.categoryName = currentCategory.name;
}
```

### Step 2: Map group codes → user-friendly categories

Build a mapping from detected group names to display categories:

```typescript
const CATEGORY_RULES: { pattern: RegExp; category: string; icon: string }[] = [
  { pattern: /компьютер|монитор|ноутбук|принтер|проектор|интерактив|цифров|системный блок/i, category: "Цифровое оборудование", icon: "🖥️" },
  { pattern: /стол|стул|шкаф|стеллаж|парт|кресл|мебел|тумб|полк/i, category: "Мебель", icon: "🪑" },
  { pattern: /дидактич|учебн|плакат|пособ|набор.*обуч|методич/i, category: "Дидактика", icon: "📚" },
  { pattern: /датчик|лаборатор|микроскоп|прибор|измерител|sensor/i, category: "Датчики и лаборатория", icon: "🔬" },
  { pattern: /игров|манеж|конструктор|горк|качел/i, category: "Игровое оборудование", icon: "🎮" },
  { pattern: /музык|пиани|синтезатор|гитар|барабан/i, category: "Музыкальное", icon: "🎵" },
  { pattern: /спорт|тренаж|мат.*гимнаст|мяч|скакалк/i, category: "Спортивное", icon: "🏋️" },
  { pattern: /медиц|аптечк|термометр/i, category: "Медицинское", icon: "🏥" },
];

function categorize(productName: string, groupName: string): { category: string; icon: string } {
  const text = `${productName} ${groupName}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule;
  }
  return { category: "Прочее", icon: "📦" };
}
```

### Step 3: Store category on each catalog_product row

The DB schema already has `category_code` and `category_name` fields in
`catalog_products`. During import, populate them:

```typescript
// In the upload/import flow:
categoryCode: currentGroupCode,   // e.g. "521-101-01"
categoryName: categorize(name, currentGroupName).category,  // e.g. "Мебель"
```

### Step 4: Add category filter tabs in the Catalogue UI

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 📚 Казниса (5,163 products)                                              │
│                                                                          │
│ [Все] [🖥️ Цифровое] [🪑 Мебель] [📚 Дидактика] [🔬 Датчики] [🎮 Игровое]│
│                                                                          │
│ ┌──────┬─────────────────────────┬─────────────────┬─────┬─────────────┐ │
│ │ Код  │ Наименование            │ Описание        │ Ед. │ Цена, ₸     │ │
│ ├──────┼─────────────────────────┼─────────────────┼─────┼─────────────┤ │
│ │ ...  │ Filtered by category    │ ...             │ ... │ ...         │ │
│ └──────┴─────────────────────────┴─────────────────┴─────┴─────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Step 5: Show category badge on match results

Each match result card shows which category the matched product belongs to:

```
┌──────────────────────────┐
│ 🥇 92%                   │
│ 🖥️ Цифровое оборудование │  ← category badge
│ Системный блок Lenovo... │
│ Код: 521-101-0401-0059   │
│ 💰 428,419 ₸ / шт        │
└──────────────────────────┘
```

## Files to modify

| File | Change |
|------|--------|
| `pm-app/src/pages/import-match.tsx` | Add category parsing during upload + filter tabs |
| `api-server/src/lib/kb-import.ts` | Add `parseCatalogWithCategories()` that tracks group headers |
| `api-server/src/lib/catalog-categories.ts` | **NEW** — keyword rules mapping |
| `api-server/src/routes/kb.ts` | Pass category during import |
| `lib/db/src/schema/knowledge-base.ts` | Already has `categoryCode`/`categoryName` ✓ |

## Alternatives considered

- **User-defined categories**: More flexible but requires manual setup. Can add later as override.
- **AI categorization**: Overkill — the code structure + keywords cover >95% of cases.
- **From file section headers**: The "Отдел 52..." lines are too broad (one section = thousands of items). The group-level codes (521-101-XX) are the right granularity.

## Priority

Low complexity, high value — users can immediately filter the 5,000-product catalogue to just "Мебель" or "Цифровое" when browsing.
