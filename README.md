# PINE Projects

PINE is a project management platform for fitout and construction teams. It provides separate workspaces for commercial **B2B** projects and government-contract **B2G** projects, each with its own workflow.

**Live platform:** [orbit-b2b-six.vercel.app](https://orbit-b2b-six.vercel.app/)

Originally exported from [Replit](https://replit.com); evolved from the **B2B Fitout Dashboard** prototype.

## Features

- **Workspace selection** — choose B2B or B2G before entering the platform
- **B2B projects** — commercial delivery workflow with P1–P6 stages
- **B2G projects** — government-contract workflow with an interactive multi-department process map
- **Projects** — project cards, progress, budget, deadlines, tasks, documents, and a project passport
- **Tasks** — Kanban workflow and cross-project task list
- **Team** — members and workload by task status (B2B)
- **Localization** — Russian, Kazakh, and English across the interface
- **Auth** — sign-in and sign-up via [Clerk](https://clerk.com)

## Этапы разработки

### 1. Фундамент — завершено

- Монорепозиторий, React-фронтенд и Express API
- PostgreSQL и схемы Drizzle ORM
- Авторизация через Clerk
- OpenAPI и сгенерированный API-клиент
- Конфигурация развертывания

### 2. Основное управление проектами — преимущественно завершено

- Раздельные рабочие пространства B2B и B2G
- Проекты и жизненный цикл P1–P6
- Карта процесса B2G с подразделениями и этапами
- Карточка проекта и отслеживание прогресса
- Задачи и Kanban-доска
- Команда и загрузка сотрудников
- Документы
- Локализация на русском, казахском и английском языках

### 3. ИИ и автоматизация — в планах

- ИИ-анализ спецификаций
- Улучшенное семантическое сопоставление товаров
- Рекомендации поставщиков
- Помощь в подготовке смет и предложений
- Уведомления о рисках и сроках
- Диалоговый ИИ-ассистент PINE B2B

### 4. Подготовка к промышленной эксплуатации и запуск — в планах

- Авторизация API и изоляция рабочих пространств
- Автоматизированные тесты
- Управляемые миграции базы данных
- Роли, разрешения и журнал аудита
- Мониторинг и резервное копирование
- Оптимизация производительности, мобильной версии и доступности
- Проверка безопасности
- Пилотное внедрение, сбор обратной связи и публичный запуск

Текущая стадия разработки — **этап 2**: развитие функциональности управления B2B- и B2G-проектами.

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
orbit/
├── artifacts/
│   ├── pm-app/          # React frontend (PINE platform)
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
- [replit.md](./replit.md) — architecture notes and gotchas

## License

MIT
