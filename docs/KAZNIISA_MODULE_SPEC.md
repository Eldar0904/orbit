# КазНИИСА Module — Architecture Specification

> Rebuild from scratch. Source of truth: `P20R0426.pdf` (Прейскурант №2 — 2026.04)

---

## 1. Overview

A dedicated module in Orbit for browsing the КазНИИСА catalogue and matching goods lists against it. The module has **two tabs**:

| Tab | Purpose |
| --- | --- |
| 📚 Каталог | Browse, search, filter — reference lookup |
| 📋 Подбор | Drop a goods list → automated matching → results with prices/specs/images |

### Core principle

The user **never manually searches** the catalogue to find matches. They drop a list, the system finds items automatically. The Каталог tab exists only for occasional manual lookups.

---

## 2. Source Data: PDF Structure

**File**: `P20R0426.pdf` — 1,198 pages, ~5,194 products

### Section A: Price Tables (pages 8–~330)

```
Columns: Код | Наименование | Единица измерения | Класс груза | Масса брутто, кг | Сметная цена, тенге | Отпускная цена, тенге

```

- Contains ALL products (~5,194 priced items + group headers)
- Group headers: rows with a code but NO price/unit (define categories)
- Hierarchical structure via code prefixes

### Section B: Description + Images (pages ~330–1198)

```
Columns: Код и наименование | Изображение | Описание

```

- A SUBSET (~3,000) of the same products from Section A
- Matched by catalogue code (join key)
- Contains product photos + detailed technical descriptions
- Some items have empty image column

### Hierarchy (from Table of Contents, page 4)

```
Отдел 52. Технологическое оборудование, мебель и инвентарь
├── Раздел 521. Оборудование и мебель организаций образования
│   ├── 521-1. Дошкольное образование (pages 3–53)
│   ├── 521-2. Начальное образование (pages 54–59)
│   ├── 521-3. Основное среднее и общее среднее (pages 60–124)
│   └── 521-4. Специальные организации (pages 125–131)
└── Раздел 522. Оборудование и мебель для всех видов
    ├── 522-1. Дошкольное и среднее (pages 132–312)
    └── 522-2. Специальные (pages 313+)

```

### Code structure

```
521-101-0401-0059
│   │    │    └── Product variant (leaf item with price)
│   │    └────── Product group (e.g., 0401 = "Средства обучения технические")
│   └─────────── Sub-section (e.g., 101 = equipment/furniture/teaching aids)
└─────────────── Section-subsection (e.g., 521-1 = Дошкольное)

```

---

## 3. Data Model (Supabase)

### Tables

```sql
-- The catalogue itself (one-time import from PDF)
CREATE TABLE kazniisa_products (
  id            serial PRIMARY KEY,
  code          text NOT NULL UNIQUE,        -- "521-101-0401-0059"
  name          text NOT NULL,               -- "Системный блок Lenovo Neo 50s G4"
  unit          text,                        -- "шт.", "комплект"
  cargo_class   smallint,                    -- 1, 2, 3, 4
  weight_kg     real,                        -- 10.65
  estimated_price real,                      -- Сметная цена (тенге)
  retail_price  real,                        -- Отпускная цена (тенге)
  description   text,                        -- From Section B (detailed specs)
  image_url     text,                        -- Supabase Storage URL (from Section B)
  has_detail    boolean NOT NULL DEFAULT false, -- true if appeared in Section B
  section_code  text NOT NULL,               -- "521-1", "521-2", etc.
  section_name  text NOT NULL,               -- "Дошкольное образование"
  group_code    text,                        -- "521-101-0400" (parent group header)
  group_name    text,                        -- "Средства обучения технические"
  normalized_text text,                      -- For pg_trgm matching
  is_group_header boolean NOT NULL DEFAULT false, -- true = category row, not a product
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Indexes for matching
CREATE INDEX idx_kazniisa_normalized_trgm ON kazniisa_products USING gin (normalized_text gin_trgm_ops);
CREATE INDEX idx_kazniisa_normalized_fts ON kazniisa_products USING gin (to_tsvector('simple', COALESCE(normalized_text, '')));
CREATE INDEX idx_kazniisa_section ON kazniisa_products (section_code);
CREATE INDEX idx_kazniisa_code ON kazniisa_products (code);

-- Match runs (history of each matching session)
CREATE TABLE match_sessions (
  id            serial PRIMARY KEY,
  filename      text NOT NULL,               -- "Детсад.xlsx"
  item_count    integer NOT NULL,
  matched_count integer NOT NULL DEFAULT 0,
  review_count  integer NOT NULL DEFAULT 0,
  no_match_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Individual match results
CREATE TABLE match_results (
  id              serial PRIMARY KEY,
  session_id      integer NOT NULL REFERENCES match_sessions(id) ON DELETE CASCADE,
  input_name      text NOT NULL,             -- Original item from user's list
  input_code      text,                      -- Code from user's list (if any)
  rank            smallint NOT NULL,          -- 1, 2, or 3
  product_id      integer REFERENCES kazniisa_products(id) ON DELETE SET NULL,
  confidence      real NOT NULL,             -- 0.0–1.0
  status          text NOT NULL DEFAULT 'pending', -- 'matched'|'review'|'no_match'
  user_decision   text,                      -- 'confirmed'|'rejected'|null
  created_at      timestamptz NOT NULL DEFAULT now()
);

```

### Storage

Product images stored in Supabase Storage bucket: `kazniisa-images/` Path: `kazniisa-images/{code}.jpg` (e.g., `kazniisa-images/521-101-0401-0059.jpg`)

---

## 4. PDF Import Pipeline

One-time (or per new edition) process. Can be run from an admin page or CLI.

```
PDF file
  ↓
Step 1: Extract text (pdf-parse / pdfjs-dist)
  ↓
Step 2: Split into Section A (price) and Section B (descriptions)
  - Detect boundary: page where header switches from
    "Код | Наименование | Ед.изм | ..." to "Код и наименование | Изображение | Описание"
  ↓
Step 3: Parse Section A → products with prices
  - Detect group headers (code + name, no price/unit)
  - Track current section (521-1, 521-2...) and group context
  - Extract: code, name, unit, cargo_class, weight, estimated_price, retail_price
  ↓
Step 4: Parse Section B → descriptions + images
  - Match by code to Section A products
  - Extract description text
  - Extract embedded images (pdf-lib or pdf.js page rendering + crop)
  ↓
Step 5: Merge → final product records
  - Section A provides: code, name, price, unit, weight, category
  - Section B provides: description, image (for ~3,000 items)
  ↓
Step 6: Upload to Supabase
  - Upsert products to kazniisa_products table
  - Upload images to Supabase Storage
  - Build normalized_text for each product
  ↓
Step 7: Create indexes (pg_trgm + FTS)

```

### Text normalization (for matching)

```typescript
normalized_text = lowercase(
  code + " " + name + " " + description
)
  .replace(/[^\p{L}\p{N}\s]/gu, " ")  // strip punctuation
  .replace(/\s+/g, " ")               // collapse whitespace
  .trim()

```

---

## 5. Matching Engine

Uses PostgreSQL `pg_trgm` + full-text search (already enabled in Supabase).

### Query per item

```sql
SELECT
  id, code, name, unit, estimated_price, description, image_url, section_name,
  (
    similarity(normalized_text, $query) * 0.55
    + LEAST(ts_rank(to_tsvector('simple', normalized_text),
            plainto_tsquery('simple', $query)) * 2.5, 1.0) * 0.30
    + CASE WHEN code = $code THEN 1.0 ELSE 0.0 END * 0.15
  ) AS score
FROM kazniisa_products
WHERE is_group_header = false
  AND (
    normalized_text % $query
    OR to_tsvector('simple', normalized_text) @@ plainto_tsquery('simple', $query)
    OR code = $code
  )
ORDER BY score DESC
LIMIT 3;

```

### Thresholds

| Score | Status | Shown? |
| --- | --- | --- |
| ≥ 90% | `matched` — high confidence | ✅ Green card |
| 70–90% | `review` — user should verify | ✅ Yellow card |
| < 70% | `no_match` | ❌ Not shown |

### Batching

Frontend sends items in batches of 25 to stay under Vercel's 10-second function timeout. Each batch is one API call that loops through items server-side.

---

## 6. API Endpoints

```
GET  /api/kazniisa/products?section=521-1&search=стол&offset=0&limit=20
     → Paginated product list with filters

GET  /api/kazniisa/products/:code
     → Single product with full details + image URL

GET  /api/kazniisa/sections
     → List of sections with product counts

POST /api/kazniisa/match
     Body: { items: [{ name: string, code?: string }] }
     → { results: [{ input, candidates: [{ product, score, status }] }] }

POST /api/kazniisa/import
     Body: multipart/form-data (PDF file)
     → { imported: number, sections: number, withImages: number }
     (Admin only — one-time import)

GET  /api/kazniisa/sessions
     → List of past matching sessions

GET  /api/kazniisa/sessions/:id/results
     → Results from a specific session

PATCH /api/kazniisa/results/:id
     Body: { decision: "confirmed" | "rejected" }
     → Updated result

```

---

## 7. Frontend (Two Tabs)

### Route: `/kazniisa`

### Tab 1: 📚 Каталог

Full-width reference browser.

```
┌──────────────────────────────────────────────────────────────────┐
│ Categories (from PDF hierarchy):                                  │
│ [Все] [521-1 Дошкольное] [521-2 Начальное] [521-3 Среднее]      │
│ [521-4 Спец.] [522-1 Общее] [522-2 Спец.общее]                  │
│                                                                  │
│ [🔍 Поиск по каталогу...]                                        │
│                                                                  │
│ ┌────────────────┬─────────────────────┬────┬───────┬──────────┐ │
│ │ Код            │ Наименование        │Ед. │Масса  │ Цена, ₸  │ │
│ ├────────────────┼─────────────────────┼────┼───────┼──────────┤ │
│ │ 521-101-0302   │ Стол рабочий на 4.. │шт  │ 10 кг │ 52 197   │ │
│ │ 521-101-0401-..│📷 Системный блок ..  │шт  │ 6.5кг │ 446 339  │ │
│ └────────────────┴─────────────────────┴────┴───────┴──────────┘ │
│ ← Стр. 1 из 260 →                                                │
│                                                                  │
│ [Click a row → expand detail card with image + full description] │
└──────────────────────────────────────────────────────────────────┘

```

### Tab 2: 📋 Подбор

The working tab. Full-width, clean.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  ⬇️ Перетащите список товаров (.xlsx, .xls, .csv)                │
│                                                                  │
│  [Select column] → [▶ Запустить подбор]                          │
│  ─────────────────────────────────────                           │
│  Progress: ████████░░ 74%                                        │
│                                                                  │
│  ──── РЕЗУЛЬТАТЫ ──── (47 совпадений / 12 на проверку / 3 нет)  │
│                                                                  │
│  1. "Стол детский регулируемый"                                  │
│     ┌───────────────────────────────────────────────────┐        │
│     │ 🥇 94%  521-101-0302                              │        │
│     │ Стол рабочий на 4 детей, 900×900×570мм            │        │
│     │ [📷]  Опоры метал., регулируемые, столешница МДФ  │        │
│     │ 💰 52,197 ₸ / шт                                  │        │
│     │                          [✓ Подтвердить] [✗]      │        │
│     └───────────────────────────────────────────────────┘        │
│     ┌───────────────────────────────────────────────────┐        │
│     │ 🥈 76%  521-101-0303-0001                         │        │
│     │ Дидактический стол с набором, L180 W50 H46        │        │
│     │ 💰 433,006 ₸ / шт                                 │        │
│     └───────────────────────────────────────────────────┘        │
│                                                                  │
│  2. "Проектор для класса" → ❌ Нет совпадений                    │
│                                                                  │
│  3. "Шкаф книжный"                                               │
│     ┌───────────────────────────────────────────────────┐        │
│     │ 🥇 91%  521-101-0307-0001                         │        │
│     │ Шкаф стеллаж для игрушек и пособий, ЛДСП 16мм    │        │
│     │ [📷]  2572×425×1230мм                             │        │
│     │ 💰 111,103 ₸ / шт                                 │        │
│     └───────────────────────────────────────────────────┘        │
│                                                                  │
│                                          [📥 Скачать XLSX]       │
└──────────────────────────────────────────────────────────────────┘

```

---

## 8. Export Format (XLSX)

When user clicks "Скачать XLSX":

| Позиция из списка | Код КазНИИСА | Наименование (каталог) | Описание | Ед.изм | Масса, кг | Сметная цена, ₸ | Совпадение % | Статус |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Стол детский | 521-101-0302 | Стол рабочий на 4 детей... | Опоры метал... | шт | 10 | 52 197 | 94% | Подтверждено |

---

## 9. Smart Column Detection (Goods List Upload)

Same heuristic from earlier — works for any file format:

1. Try known Russian/English header patterns
2. Fallback: score each column by text length + uniqueness + Cyrillic presence
3. Show 5-row preview → user confirms or picks different column

---

## 10. Tech Stack

| Layer | Tech |
| --- | --- |
| Frontend | React, Vite, Tailwind, TanStack Query |
| API | Express 5 (existing Orbit API) |
| Database | Supabase PostgreSQL + pg_trgm |
| Storage | Supabase Storage (product images) |
| PDF parsing | `pdf-parse` (text) + `pdf-lib` or page rendering (images) |
| Matching | PostgreSQL similarity() + ts_rank() |
| Deploy | Vercel (same as rest of Orbit) |

---

## 11. Files to Create

```
artifacts/api-server/src/
  routes/kazniisa.ts            — API routes
  lib/kazniisa-parser.ts        — PDF text parsing (Section A + B)
  lib/kazniisa-images.ts        — Image extraction from PDF
  lib/kazniisa-matcher.ts       — pg_trgm matching queries
  lib/kazniisa-normalize.ts     — Text normalization

artifacts/pm-app/src/
  pages/kazniisa.tsx            — Main page (two tabs)
  components/kazniisa/
    catalog-tab.tsx             — Browse/search tab
    matching-tab.tsx            — Upload + results tab
    product-card.tsx            — Expandable product detail
    match-result-card.tsx       — Single match result
    column-picker.tsx           — Column selection preview

lib/db/src/schema/
  kazniisa.ts                   — Drizzle schema

scripts/
  import-kazniisa-pdf.ts        — CLI script for one-time import
  cleanup-kazniisa-module.sql   — DB reset (already exists)

```

---

## 12. Implementation Order

| Phase | What | Effort |
| --- | --- | --- |
| 1 | DB schema + API skeleton + empty frontend tabs | 1 session |
| 2 | PDF parser (Section A → products with prices) | 1 session |
| 3 | Catalogue tab (browse, search, paginate, categories) | 1 session |
| 4 | Matching engine (pg_trgm + matching API) | 1 session |
| 5 | Подбор tab (upload, column detect, run, display results) | 1 session |
| 6 | PDF parser (Section B → descriptions + images) | 1 session |
| 7 | Image extraction + storage + display in UI | 1 session |
| 8 | Export XLSX + match history | 0.5 session |

Total: ~7–8 sessions for the complete module.

---

## 13. Migration from Old Module

- Old tables already dropped (cleanup SQL ran today)
- Old code files already deleted
- `pg_trgm` extension already enabled in Supabase
- Route `/import-match` currently shows "в разработке" placeholder
- Will be replaced with `/kazniisa` route

---

## 14. Open Questions

1. **PDF editions** — Updates every 2–3 months. ✅ Version system needed. Each import creates a new version; old versions kept for reference but only the latest is used for matching.
2. **Image quality** — TBD. Need to extract sample images from the PDF and check resolution. Will determine during Phase 6 (image extraction).
3. **Multiple prices** — **Сметная цена** is the one used for matching results and export. Отпускная stored but secondary.
4. **Match history** — ✅ Saved. Each session (filename + date + results) persists. Users can revisit past matching runs.

