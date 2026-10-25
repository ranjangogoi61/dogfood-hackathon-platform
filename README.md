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
| Events | `GET/POST /api/events`, `GET/PATCH /api/events/{id}` (draft → published → closed), `GET/POST /api/events/{id}/tracks` |
| Teams | `POST /api/teams`, `POST /api/teams/join` (invite code, server-enforced size cap) |
| Projects | `POST /api/projects`, `GET/PATCH /api/projects/{id}` (drafts private; edits stop at the deadline) |
| Judge management | `POST/GET /api/events/{id}/judges`, `PUT/GET /api/events/{id}/rubric` (locked after first score), `POST /api/events/{id}/assignments` (manual or auto), `GET /api/events/{id}/progress` |
| Health | `GET /api/health`, `GET /api/ready` (503 when DB is down) |
| Public gallery | `GET /api/gallery` (`event_id`, `track_id`, `q` filters; no auth) |
| Submission | `POST /api/projects/{id}/submit` (server-side deadline, team-member/organizer/admin only) |
| Judging | `GET /api/judging/assignments` (own only), `GET/POST /api/judging/scores` (own only; range + window validated) |
| Results | `GET /api/events/{id}/export` (organizer/admin CSV; per-judge z-score normalization with documented fallback) |

Docs: [`docs/NORMALIZATION.md`](docs/NORMALIZATION.md) · [`docs/EXTENSION-POINTS.md`](docs/EXTENSION-POINTS.md)

### Normalization

Per-judge z-score is applied only when the judge has at least `normalization_min_samples` (default 3) scored projects **and** σ > `normalization_epsilon` (default 1e-6). Otherwise raw 0–100 scores are used (flagged in code as `raw_fallback`). Incomplete scores are never treated as zero. See `src/lib/judging/normalization.ts` and `tests/normalization.test.ts`.

### Authorization model

Roles are event-scoped (`event_roles`); `users.is_admin` is global. All checks run server-side. Judges can read only their own assignments and scores; peers and participants get 401/403.

## Not yet implemented

- Prizes (events and tracks exist; prize records do not)
- Web UI beyond the public gallery page (the portal is API-first)
- Email delivery: judges are invited by email address of an already registered user, teams by invite code
- Audit events (planned; see `docs/EXTENSION-POINTS.md`)
- Withdrawal endpoint for projects
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
- **`TRUST_PROXY`** (default `false`): `X-Forwarded-For` is ignored unless this is `true`. Login throttling always limits per account (5 failures / 15 min → 429); the per-IP bucket (30 failures) is active only when `TRUST_PROXY=true`, so set it when running behind your own reverse proxy.
- The demo password is public; run with `SEED_DEMO=false` in production.

See `SECURITY.md` for reporting issues.
