# Packman 行李管理系統

Competition luggage management system for robotics teams. Built to replace the Notion-based workflow for international competitions.

## Features

- **物品清單** — Add, edit, filter items by group/box/status/shipping method
- **箱子管理** — Organize items into checked/carry-on boxes with QR checklists
- **電池分配** — Battery assignment with Taiwan CAA + French DGAC regulation reminders
- **AI 自動標籤** — Upload item photos, local Ollama vision model auto-generates Chinese tags
- **QR Code 掃描** — Scan box/item QR codes to open checklists instantly on mobile
- **貼紙列印** — Generate PDF stickers in 4 sizes (50×30mm to A4 sheet)
- **Slack 登入** — Single sign-on via your private Slack workspace
- **管理後台** — Admin panel for user/group management and CSV export

## Architecture

| Service | Port | Description |
|---------|------|-------------|
| Main app | 3000 | React + Vite frontend |
| Admin panel | 3001 | Admin React + Vite frontend |
| API | 8080 | Node.js + Fastify + TypeScript |
| PostgreSQL | 5432 (internal) | Database |
| MinIO | 9000/9001 | Photo storage |

## Setup

### 1. Slack App

1. Go to https://api.slack.com/apps → **Create New App** → From scratch
2. Name: `Packman` — select your workspace
3. **OAuth & Permissions** → Add redirect URL:
   ```
   http://YOUR_HOMELAB_IP:8080/auth/slack/callback
   ```
4. User Token Scopes: `identity.basic`, `identity.email`, `identity.avatar`
5. **Basic Information** → copy **Client ID** + **Client Secret**
6. Find your Workspace ID in the URL: `https://app.slack.com/client/TXXXXXXXX/`

### 2. Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the infrastructure settings:
- `DATABASE_URL` — PostgreSQL connection string
- `MINIO_*` — MinIO connection settings; change `MINIO_SECRET_KEY` from the default
- `PORT` / `NODE_ENV` — API runtime settings

Slack OAuth, App URLs, the admin account, Ollama servers, the active vision model, and AI prompt settings are managed in the Admin UI. JWT and cookie signing secrets are generated automatically on first API startup and stored in the database.

### 3. Build and Start

```bash
docker compose build
docker compose up -d
```

### 4. Initial Data

The API seeds default data automatically on first startup. This creates:
- **Groups**: 一個範例組別（可在管理後台刪除）
- **Boxes**: 一個範例箱（可在管理後台刪除）

On first visit to the admin panel, create the admin username and password. Slack login is only for normal app users.

## Development

All code runs inside Docker — no local Node.js required.

### UI Development (with HMR)

Use the dev compose file when iterating on frontend code — Vite dev servers with Hot Module Replacement, no rebuild needed on every change:

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Web app: http://localhost:3000
- Admin panel: http://localhost:3001

Changes to `apps/web/src/` and `apps/admin/src/` are reflected instantly.
Rebuilding is only needed when adding packages or changing `packages/shared`.

### Production Build

```bash
docker compose build
docker compose up -d
```

```bash
# View logs
docker compose logs -f api
docker compose logs -f web

# Restart a service after code changes
docker compose restart api

# Run a migration
docker compose exec api npx prisma migrate dev --name my_migration

# Open Prisma Studio (DB browser)
docker compose exec api npx prisma studio --port 5555 --browser none
# Then access http://localhost:5555

# MinIO web console
# http://YOUR_IP:9001  (user: packman, password: from MINIO_SECRET_KEY in .env)

# Manually seed the database
docker compose exec api node dist/seed.js
```

## Sticker Sizes

| Size | Dimensions | Use case |
|------|-----------|----------|
| SMALL | 50×30mm | Small labels |
| MEDIUM | 100×50mm | Standard labels |
| LARGE | 150×100mm | Large box labels |
| A4_SHEET | A4 with 2×4 grid | 8 labels per sheet |

## Battery Regulations

The battery management page includes built-in reminders for:
- 🇹🇼 Taiwan CAA carry-on rules (工具機電池, 行動電源, 磁酸鋰鐵電池)
- 🇫🇷 French DGAC / IATA rules for international flights

## QR Code Workflow

1. **Print stickers** — Generate box/item sticker PDFs with embedded QR codes
2. **Attach stickers** — Stick on boxes/items before packing
3. **Scan on-site** — Use `/scan` page on mobile → opens checklist
4. **Check off items** — Tap to verify items in the box

## Data Export

Admin panel (`http://YOUR_IP:3001`) → **匯出資料**:
- `items.csv` — Full item list with all fields (UTF-8 BOM for Excel)
- `batteries.csv` — Battery assignment list
