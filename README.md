# Dogfood Hackathon Platform

Open-source, self-hostable hackathon submission and judging platform.
Next.js 15 (App Router) · TypeScript · PostgreSQL 16 · Drizzle ORM · Docker Compose.

## Quick start

```bash
docker compose up --build
# portal: http://localhost:3000
```

Three containers start in order: `db` → `db-init` (runs migrations, then loads idempotent demo fixtures) → `app`.
The runtime needs no external network. Set `SEED_DEMO=false` on `db-init` to skip demo data.

### Demo accounts (password for all: `DogfoodDemo123!`)

| Role | Email |
| --- | --- |
| Organizer | `organizer@dogfood.local` |
| Judge A | `judge-a@dogfood.local` |
| Judge B | `judge-b@dogfood.local` |
| Participant | `participant@dogfood.local` |

Fixtures: published event `dogfood-demo-2026`, closed event `dogfood-closed-demo-2026`, a submitted project, a rubric (3 weighted criteria), two judge assignments with scores, and a draft project in the closed event.

## Implemented

| Area | Endpoint(s) |
| --- | --- |
| Identity | `POST /api/auth/register`, `/login`, `/logout`, `GET /api/auth/me` (DB-backed opaque sessions, SHA-256 hashed, sliding + absolute TTL) |
| Health | `GET /api/health`, `GET /api/ready` (503 when DB is down) |
| Public gallery | `GET /api/gallery` (`event_id`, `track_id`, `q` filters; no auth) |
| Submission | `POST /api/projects/{id}/submit` (server-side deadline, team-member/organizer/admin only) |
| Judging | `GET /api/judging/assignments` (own only), `GET/POST /api/judging/scores` (own only; range + window validated) |
| Results | `GET /api/events/{id}/export` (organizer/admin CSV; per-judge z-score normalization with documented fallback) |

### Normalization

Per-judge z-score is applied only when the judge has at least `normalization_min_samples` (default 3) scored projects **and** σ > `normalization_epsilon` (default 1e-6). Otherwise raw 0–100 scores are used (flagged in code as `raw_fallback`). Incomplete scores are never treated as zero. See `src/lib/judging/normalization.ts` and `tests/normalization.test.ts`.

### Authorization model

Roles are event-scoped (`event_roles`); `users.is_admin` is global. All checks run server-side. Judges can read only their own assignments and scores; peers and participants get 401/403.

## Not yet implemented

- Event / track / prize management endpoints (events are currently created by seed)
- Team create / invite / join endpoints and project draft/edit endpoints
- Judge invitation and assignment management UI/endpoints, rubric editing
- Login throttling (planned for T1; requires the trusted-proxy rule below first)
- Audit events
- T3 / T4 are documented extension points only: voting, comments, randomized ordering, duplicate detection, audit query; REST docs, webhooks, certificates, embeds, bulk import/export

## Verification

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build
bash scripts/acceptance.sh http://localhost:3000   # against a running seeded stack
```

CI runs all of the above plus `docker compose up`, health/ready checks, and a DB-down → 503 check.

## Deployment and security notes

- **HTTPS is terminated outside the app** (Caddy / Nginx / Traefik). Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `APP_URL` is `https://`.
- **Secrets**: never commit `.env`; change the default DB password for any non-local deployment and rotate it by updating `DATABASE_URL` and the Postgres user together.
- **`TRUST_PROXY`** (default `false`): do not trust `X-Forwarded-For` unless the app sits behind your own proxy. This must be wired in before login throttling ships.
- The demo password is public; run with `SEED_DEMO=false` in production.

See `SECURITY.md` for reporting issues.
