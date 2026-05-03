<p align="right"><a href="README.zh-TW.md">繁體中文</a></p>

<div align="center">

<img src="apps/admin/public/favicon.svg" alt="Packman logo" width="120">

# Packman

**Competition luggage management system for robotics teams.**

[![GitHub stars](https://img.shields.io/github/stars/SeanChangX/packman)](https://github.com/SeanChangX/packman) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Build & push](https://github.com/SeanChangX/packman/actions/workflows/build-and-push.yml/badge.svg)](https://github.com/SeanChangX/packman/actions/workflows/build-and-push.yml)

<table>
<tr>
<td width="50%" align="center"><img src="docs/images/Dashboard.png" alt="Dashboard" width="100%"><br><strong>Dashboard</strong><br>Packing progress, box status grid</td>
<td width="50%" align="center"><img src="docs/images/Items.png" alt="Items" width="100%"><br><strong>Items</strong><br>Searchable, filter by group / box / status</td>
</tr>
<tr>
<td width="50%" align="center"><img src="docs/images/Boxes.png" alt="Boxes" width="100%"><br><strong>Boxes</strong><br>Per-box weight, item count, QR sticker</td>
<td width="50%" align="center"><img src="docs/images/ItemDetail.png" alt="Item detail" width="100%"><br><strong>Item detail</strong><br>Photo upload, AI auto-tagging via Ollama</td>
</tr>
<tr>
<td width="50%" align="center"><img src="docs/images/AdminEvents.png" alt="Admin Events" width="100%"><br><strong>Admin — Events</strong><br>Per-event scoping, switch active event</td>
<td width="50%" align="center"><img src="docs/images/AdminBackup.png" alt="Admin Backup" width="100%"><br><strong>Admin — Backup & restore</strong><br>Full ZIP export including photos</td>
</tr>
</table>

<br>

<div align="center">

[**Features**](#features) &#8226;
[**Getting started**](#getting-started) &#8226;
[**Architecture**](#system-architecture) &#8226;
[**Stickers & QR**](#stickers--qr-workflow) &#8226;
[**AI tagging**](#ai-auto-tagging) &#8226;
[**Backup**](#backup--restore) &#8226;
[**Development**](#development)

</div>

</div>

---

## Features

Packing for an international robotics competition with 30+ people, 5 oversized boxes, dozens of batteries and a flight that won't take any of them in the wrong category — that's how this started. We were tracking everything in a Notion table that nobody updated. Packman replaces that with a single source of truth, scannable QR codes on every box, AI-tagged photos so you can find anything by what it looks like, and per-event scoping so the same system works year after year.

- **Items** — Add, edit, search by name/tag, filter by group/box/status/shipping
- **Boxes** — Organize items into checked / carry-on, scannable QR sticker per box
- **Batteries** — Per-battery assignment with Taiwan CAA + French DGAC reminders
- **AI auto-tagging** — Snap a photo, local Ollama vision model writes the tags
- **QR scan-on-site** — Open `/scan` on phone, point at sticker, jump to checklist
- **Sticker printing** — PDF stickers in 4 sizes (50×30 mm to A4 sheet)
- **Slack SSO** — Sign in with your team's private Slack workspace
- **Per-event scoping** — One DB, many events (Eurobot 2025 / 2026 / …); active event switch
- **Full backup** — Database + photos exported as a single ZIP, restorable in one click

<p align="right">— Made by SCX, originally for the <a href="https://github.com/DIT-ROBOTICS/">DIT Robotics</a> team.</p>

---

## Getting started

### Prerequisites

- Docker and Docker Compose
- A Slack workspace (for SSO login)
- (Optional) A machine running Ollama with a vision model (`llava` etc.) for AI tagging

### Run with Docker

1. Clone:
   ```bash
   git clone https://github.com/SeanChangX/packman.git
   cd packman
   ```

2. Copy the example env and edit infra-only fields:
   ```bash
   cp .env.example .env
   ```

   Slack OAuth / app URLs / admin account / Ollama servers / branding are all configured **in the admin UI**, not in `.env`. JWT and cookie secrets are auto-generated on first startup.

3. Pull pre-built production images and start:
   ```bash
   docker compose pull
   docker compose up -d
   ```

   Or build locally:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```

4. **Set the admin password first.** Open **http://localhost:3001** (admin panel). On first visit it shows a setup form — choose username + password.

5. Use the app:
   - **http://localhost:3000** — Main app (members)
   - **http://localhost:3001** — Admin panel
   - **http://localhost:9001** — MinIO console (photo storage)

### Slack app setup

1. https://api.slack.com/apps → **Create New App** → From scratch
2. Name `Packman`, pick your workspace
3. User Token Scopes: `identity.basic`, `identity.email`, `identity.avatar`
4. In **Admin → Settings**, set the **Web URL** to your public address (e.g. `https://packman.example.com`). The Slack Redirect URI is auto-derived as `${WEB_URL}/auth/slack/callback` and shown read-only in the Slack section — copy it into your Slack app's **OAuth & Permissions → Redirect URLs**.
5. Copy **Client ID** + **Client Secret** + **Workspace ID** from Slack into Admin → Settings → Slack.

---

## System architecture

```
                ┌─ Web nginx (3000) ─┐  proxies /api, /auth
[ Browser ] ────┤                    ├──→ [ API (internal :8080) ] ─── [ Postgres (internal) ]
                └─ Admin nginx (3001)┘                                 └─ [ MinIO (internal :9000) ]
                                                                       └─ [ Ollama (vision LLM) ]
```

In production, only the Web (`3000`) and Admin (`3001`) nginx containers are reachable from outside the Docker network. API, Postgres, and MinIO have no published ports — the SPAs call `/api/*` and `/auth/*` on their own origin and nginx reverse-proxies to the API. This keeps the attack surface to the two SPA front-ends.

| Service | Public port (prod) | Stack |
|---------|--------------------|-------|
| **Web** | 3000 | React + Vite + TanStack Router/Query |
| **Admin** | 3001 | React + Vite (separate SPA) |
| **API** | — (internal :8080) | Node.js + Fastify + Prisma + TypeScript |
| **Postgres** | — (internal) | Schema with per-event scoping, GIN/trigram indexes |
| **MinIO** | console on 127.0.0.1:9001 | S3-compatible photo storage (S3 API internal :9000) |

> **Admin URL safety.** The Admin URL configured in **Admin → Settings** must match the address you use to reach the admin console (used as a CORS origin). If they diverge, the admin SPA will be unable to call the API and you'll be locked out — recovery requires editing the `system_setting` row directly via `docker compose exec postgres psql`. The admin UI shows a confirmation prompt if you try to save a value that doesn't match your current location. For production, exposing port `3001` only on a private network or behind a VPN is recommended.

Docker images are built on every push to `main` via [GitHub Actions](.github/workflows/build-and-push.yml) and pushed to `ghcr.io/seanchangx/packman-{api,web,admin}` with `latest`, branch, sha, and semver tags.

---

## Stickers & QR workflow

1. **Print stickers** — Admin panel → Sticker Print → choose size and items/boxes → PDF
2. **Stick before packing** — Each sticker has a QR code pointing at the item/box page
3. **Scan on-site** — Open `/scan` on phone, point at a box sticker, get the checklist
4. **Tick off items** — Mark each item PACKED / SEALED as you load it

| Sticker size | Dimensions | Use case |
|---|---|---|
| SMALL | 50 × 30 mm | Small parts, individual items |
| MEDIUM | 100 × 50 mm | Standard item labels |
| LARGE | 150 × 100 mm | Box ID labels |
| A4_SHEET | A4, 2 × 4 grid | 8 stickers per page |

Stickers include the brand logo (configurable in Admin → Settings → Brand) and embed a QR code that opens the item or box detail page on any phone.

---

## AI auto-tagging

Optional Ollama integration. Upload an item photo → background worker calls a local Ollama vision model → tags appear on the item record.

- Set up one or more Ollama endpoints in **Admin → AI Recognition**
- Pick a vision model (e.g. `llava`, `llama3.2-vision`)
- Customize the tagging prompt (default works for general gear)
- Health checks + latency stats per endpoint, automatic failover

Photos and tags are searchable from the items page. Re-tag any photo manually from its detail page.

---

## Per-event scoping

One Packman instance can run multiple events. Items, boxes, and batteries are scoped to the **active event**; switching events instantly changes what users see, without touching the data.

- Admin → Events → create / rename / activate / delete
- Same box label (e.g. "1") can exist in different events without conflict
- Backups capture all events at once

---

## Backup & restore

Admin → Export → **Backup & Restore**:

- Downloads `packman-backup-YYYY-MM-DD.zip` containing:
  - `data.json` — all events, items, boxes, batteries, users, groups, event memberships, options, regulations, settings, Ollama endpoints
  - `photos/` — every photo in MinIO (item photos + brand logo)
- **Restore** uploads the same ZIP back: wipes current data inside a transaction, then re-imports everything including photos
- Validates ZIP magic bytes, version (1.x), required fields, and only allows whitelisted photo extensions (jpg/png/webp/gif/heic)

---

## Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

| Service | URL |
|---------|-----|
| Web (Vite HMR) | http://localhost:3000 |
| Admin (Vite HMR) | http://localhost:3001 |
| API | http://localhost:8080 |
| MinIO console | http://localhost:9001 |

Changes to `apps/web/src/` and `apps/admin/src/` reload instantly. Rebuild only when adding packages or changing `packages/shared`.

### Useful commands

```bash
# Logs
docker compose logs -f api

# Open a Prisma migration shell
docker compose exec api npx prisma migrate dev --name my_change

# Browse the DB
docker compose exec api npx prisma studio --port 5555 --browser none
# → http://localhost:5555

# Re-seed
docker compose exec api node dist/seed.js
```

### Releasing

Push to `main` triggers a [GitHub Actions](.github/workflows/build-and-push.yml) build that pushes 3 images to GHCR with `latest` + branch + sha tags. Push a `v*` tag to also publish semver tags:

```bash
git tag v1.0.0 && git push --tags
# Server side:
IMAGE_TAG=v1.0.0 docker compose up -d
```

---

## Troubleshooting

### Forgot the admin password

There is no built-in password-reset flow (no email, no reset link). The admin credentials live in the `SystemSetting` table; deleting those rows puts the admin console back into "first-time setup" mode and you can choose a new username + password.

```bash
# 1. Back up the DB first
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-packman}" "${POSTGRES_DB:-packman}" > pre-reset-backup.sql

# 2. Drop the admin credentials
docker compose exec -T postgres psql -U "${POSTGRES_USER:-packman}" -d "${POSTGRES_DB:-packman}" \
  -c "DELETE FROM \"SystemSetting\" WHERE key IN ('admin.username', 'admin.passwordHash') RETURNING key;"

# 3. Reload the admin URL — it now shows the setup form again
```

Nothing else is touched: events, items, boxes, batteries, users, groups, Slack OAuth, brand, Ollama endpoints, JWT/cookie secrets, and existing user sessions all survive. Only the admin login is reset.

---

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) - see the [LICENSE](LICENSE) file for details.

____
