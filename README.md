# PINE B2B

PINE B2B is a project management workspace for fitout and construction teams. Track projects through staged delivery (P1–P6), assign tasks, manage team workload, register documents, and run the sourcing workflow (catalog matching → suppliers → commercial offer → procurement).

Originally exported from [Replit](https://replit.com); evolved from the **B2B Fitout Dashboard** prototype. See [docs/B2B_REFERENCE.md](./docs/B2B_REFERENCE.md) for phase definitions, AI roadmap, and architecture mapping.

## Features

- **Dashboard** — project and task stats, completion rate, recent activity feed
- **Projects** — rich project cards with progress, P1–P6 stage stepper, budget and deadline stats
- **Catalogs** — workspace knowledge base: import catalogs, manage suppliers, growing product library
- **Project detail** — Tasks (kanban), Documents, Sourcing & Offer (spec matching, AI suppliers, КП export), Overview (project passport)
- **All Tasks** — cross-project task list with filters
- **Team** — add members, view workload by status
- **Auth** — sign-in / sign-up via [Clerk](https://clerk.com)

## Этапы разработки

### 1. Фундамент — завершено

- Монорепозиторий, React-фронтенд и Express API
- PostgreSQL и схемы Drizzle ORM
- Авторизация через Clerk
- OpenAPI и сгенерированный API-клиент
- Конфигурация развертывания

### 2. Основное управление проектами — преимущественно завершено

- Дашборд
- Проекты и жизненный цикл P1–P6
- Карточка проекта и отслеживание прогресса
- Задачи и Kanban-доска
- Команда и загрузка сотрудников
- Документы
- Локализация на русском, казахском и английском языках

### 3. Каталоги и спецификации — в разработке

- Единый каталог продукции
- Импорт каталога КазНИИСА
- Загрузка спецификаций из Excel и CSV
- Поиск и сопоставление продукции
- Проверка и корректировка результатов
- Сохранение сессий сопоставления

### 4. Поиск и выбор поставщиков

- База поставщиков
- Формирование запросов коммерческих предложений
- Сбор предложений поставщиков
- Подбор альтернативных товаров
- Сравнение цен и сроков поставки
- Формирование короткого списка поставщиков

### 5. Коммерческое предложение

- Расчет себестоимости
- Наценки и скидки
- Подготовка коммерческого предложения для клиента
- Экспорт в Excel и PDF
- Версии предложений и история согласований

### 6. Закупки и поставка

- Заказы поставщикам
- Графики платежей
- Отслеживание заказов и поставок
- Приемка на складе или объекте
- Контроль монтажа
- Закупочная документация

### 7. ИИ и автоматизация

- ИИ-анализ спецификаций
- Улучшенное семантическое сопоставление товаров
- Рекомендации поставщиков
- Помощь в подготовке смет и предложений
- Уведомления о рисках и сроках
- Диалоговый ИИ-ассистент PINE B2B

### 8. Подготовка к промышленной эксплуатации и запуск

- Авторизация API и изоляция рабочих пространств
- Автоматизированные тесты
- Управляемые миграции базы данных
- Роли, разрешения и журнал аудита
- Мониторинг и резервное копирование
- Оптимизация производительности, мобильной версии и доступности
- Проверка безопасности
- Пилотное внедрение, сбор обратной связи и публичный запуск

Текущая стадия разработки — **этап 3**: основное рабочее пространство готово, а активная разработка сосредоточена на каталогах и сопоставлении продукции КазНИИСА.

## Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces, Node.js 24, TypeScript |
| Frontend | React 19, Vite, Wouter, TanStack Query, Tailwind CSS 4 |
| API | Express 5, OpenAPI-first (Orval codegen) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk |

## Prerequisites

- Node.js 24+
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- PostgreSQL ([Supabase](https://supabase.com) or local)
- Clerk application ([dashboard.clerk.com](https://dashboard.clerk.com))

## Quick start

See **[LOCAL_DEV.md](./LOCAL_DEV.md)** for full Windows setup.

```powershell
# 1. Clone and install
git clone https://github.com/Eldar0904/orbit.git
cd orbit
pnpm install

# 2. Environment (copy templates, then fill in secrets)
Copy-Item .env.example .env
# Edit .env: DATABASE_URL, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
# Edit artifacts/pm-app/.env.local: VITE_CLERK_PUBLISHABLE_KEY

# 3. Create database tables
pnpm --filter @workspace/db run push

# 4. Run (two terminals)
pnpm --filter @workspace/api-server run dev   # http://localhost:8080
pnpm --filter @workspace/pm-app run dev       # http://localhost:5173
```

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | root `.env` | PostgreSQL connection (Supabase or local) |
| `CLERK_SECRET_KEY` | root `.env` | Clerk server key |
| `CLERK_PUBLISHABLE_KEY` | root `.env` | Clerk publishable key |
| `VITE_CLERK_PUBLISHABLE_KEY` | `artifacts/pm-app/.env.local` | Same publishable key for the frontend |

Never commit `.env` or `.env.local` — they are in `.gitignore`.

## Project structure

```
SaaS-Task-Manager/
├── artifacts/
│   ├── pm-app/          # React frontend (Orbit UI)
│   └── api-server/      # Express API
├── lib/
│   ├── api-spec/        # OpenAPI spec (source of truth)
│   ├── api-client-react/# Generated React Query hooks
│   ├── api-zod/         # Generated Zod validators
│   └── db/              # Drizzle schema + migrations
├── docs/
│   ├── PROJECTS_SPEC.md # Projects section UX spec
│   └── B2B_REFERENCE.md # B2B prototype phases, roadmap, architecture
├── .env.example
├── LOCAL_DEV.md
└── replit.md            # Replit deployment notes
```

## Common commands

```powershell
pnpm run typecheck                              # Typecheck all packages
pnpm run build                                  # Build all packages
pnpm --filter @workspace/api-spec run codegen   # Regenerate API client after OpenAPI changes
pnpm --filter @workspace/db run push            # Push schema to Postgres (dev)
```

## Documentation

- [LOCAL_DEV.md](./LOCAL_DEV.md) — local setup on Windows
- [docs/DEPLOY_VERCEL.md](./docs/DEPLOY_VERCEL.md) — deploy to Vercel (frontend + API)
- [docs/PROJECTS_SPEC.md](./docs/PROJECTS_SPEC.md) — projects section fields, tabs, and stages
- [docs/B2B_REFERENCE.md](./docs/B2B_REFERENCE.md) — B2B prototype phases, AI roadmap, and Orbit mapping
- [replit.md](./replit.md) — architecture notes and gotchas

## License

MIT
