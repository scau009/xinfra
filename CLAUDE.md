# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Plat — Lightweight Auto-Deploy Platform

Plat is a Vercel-like self-hosted deploy platform targeting vibe coders. Users connect a GitHub repo or upload via CLI, and the platform auto-detects the framework, builds a Docker image, and runs the container behind Traefik with automatic SSL.

## Quick commands

```bash
# Start all services
cd platform && docker compose up -d

# Stop everything
cd platform && docker compose down

# View logs for a specific service
docker compose logs -f api-server
docker compose logs -f build-runner

# API Server (dev mode with hot reload)
cd platform/api-server && npm run dev

# Web frontend (dev mode with hot reload, proxies /api to :3000)
cd platform/web && npm run dev

# Web frontend (production build)
cd platform/web && npm run build

# Access PostgreSQL directly (for debugging)
docker compose exec postgres psql -U plat -d plat

# Check Redis queues
docker compose exec redis redis-cli LLEN build:queue
docker compose exec redis redis-cli LLEN deploy:queue
```

There are no automated tests yet — this is an early-stage MVP.

## High-level architecture

Six services orchestrated via `platform/docker-compose.yml`, designed to run on a single 4C8G machine:

```
User (GitHub push / CLI upload)
        │
        ▼
   API Server (Express, port 3000)
        │
        ▼ RPUSH build:queue
      Redis ──────────────────────► Build Runner (BLPOP, build & push image)
        │                                   │
        │ RPUSH deploy:queue ◄──────────────┘
        ▼
  Deploy Scheduler (BLPOP, docker run with Traefik labels)
        │
        ▼
    Traefik ───► user app containers (dynamic routing + Let's Encrypt SSL)
```

### Service responsibilities

| Service | Dir | Role |
|---------|-----|------|
| **api-server** | `platform/api-server/` | REST API, GitHub OAuth, project/deploy CRUD, SSE log streaming. Auth via JWT (web) or API key (CLI). |
| **build-runner** | `platform/build-runner/` | Worker: fetch source (git clone or tar extract) → detect framework → generate Dockerfile → `docker buildx build --push` → enqueue deploy task. |
| **deploy-scheduler** | `platform/deploy-scheduler/` | Worker: `docker pull` → stop old container → `docker run -d` with Traefik labels, env vars, resource limits. |
| **web** | `platform/web/` | React SPA (Vite) with login, dashboard, project detail, deploy log SSE viewer, env var management. |
| **cli** | `platform/cli/` | Node.js CLI (`plat login`, `plat deploy`): packs project as tar.gz, uploads to API server, streams deploy logs. |
| **traefik** | `platform/traefik/` | Reverse proxy with Docker provider — discovers running containers via their labels and auto-routes with Let's Encrypt. |

### Data flow (two entry points, shared pipeline)

- **GitHub path**: user pushes → GitHub webhook → API Server verifies HMAC → enqueues build → Build Runner `git clone`s → builds → enqueues deploy → Deploy Scheduler runs container.
- **CLI path**: `plat deploy` → tar + upload → API Server enqueues build (with `sourceType: 'cli'`, `tarPath`) → Build Runner extracts tar → same build/deploy pipeline.

### Redis queues

- `build:queue` — API Server RPUSH, Build Runner BLPOP
- `deploy:queue` — Build Runner RPUSH, Deploy Scheduler BLPOP
- `build:log:<deployId>` — Build/Deploy workers RPUSH log lines; API Server BLPOP for SSE streaming to frontend. Expires after 1 hour.

### Framework auto-detection (cascade, priority order)

Defined in `platform/build-runner/src/detectors/index.js`. Each detector checks for feature files and returns `{ framework, targetPort, needsBuild }` or `null`:

1. **Custom Dockerfile** — user has `Dockerfile` → use as-is
2. **Next.js** — `package.json` has `next` dep
3. **Express** — `package.json` has `express` dep
4. **Generic Node** — `package.json` exists with a `start` script
5. **Static** — `index.html` found in root/dist/public/build → serve with nginx

Dockerfile templates live in `platform/build-runner/src/templates/`.

### Database (PostgreSQL, schema auto-created in `db.js`)

- `users` — GitHub OAuth login, auto-generated API key (via `pgcrypto`)
- `projects` — linked to a user; auto-assigned domain `<repo>.<username>.<platform-domain>`
- `deploys` — status lifecycle: `pending → building → deploying → running` (or `failed`)
- `env_vars` — AES-256-GCM encrypted values; decrypted at deploy time by deploy-scheduler

### Auth

- **Web (JWT)**: GitHub OAuth callback → find-or-create user → sign JWT (7d expiry) → store in browser localStorage. Middleware: `jwtAuth` in `platform/api-server/src/middleware/jwtAuth.js`.
- **CLI (API Key)**: User gets API key from dashboard → `plat login` saves to `~/.platrc` (chmod 600) → CLI uses Bearer token from `POST /api/cli/login`. Middleware: `apiKeyAuth`.

### Environment variables

- Stored encrypted (AES-256-GCM) in `env_vars` table. Key is `ENCRYPTION_KEY` (64-char hex) in `.env`.
- Decrypted at deploy time by deploy-scheduler, injected as `docker run --env KEY=VALUE`.
- Platform injects `PLATFORM_APP_URL` and `PORT` automatically.
- Encryption is duplicated in api-server (`services/crypto.js`) and deploy-scheduler (`env.js`) — keep them in sync.

### Configuration

All config via environment variables (see `platform/.env.example`). Each service has its own `config.js` that reads the subset it needs. The API server loads from `../.env.example` (hardcoded path — be aware when deploying).

## Key patterns

- **No inter-service HTTP calls**: services communicate only through Redis queues and the shared PostgreSQL database.
- **Docker socket sharing**: build-runner and deploy-scheduler mount `/var/run/docker.sock` — they must run on the same host as Docker Engine.
- **BLPOP blocking loops**: both workers run infinite `while(true)` loops blocking on Redis BLPOP. On crash, docker compose `restart: unless-stopped` brings them back.
- **SSE for real-time logs**: `GET /api/deploys/:id/logs` polls Redis with `BLPOP ... 1` (1-second timeout) inside a 500ms `setInterval`, streaming results as Server-Sent Events.
