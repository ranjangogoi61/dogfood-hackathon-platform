# Extension points (T3 / T4)

T3 and T4 are intentionally **not implemented**. This page records where each would attach so the current design does not block them. Nothing here is a claim of working functionality.

## T3 — community and integrity

| Feature | Attaches to | Notes |
| --- | --- | --- |
| Public voting / likes | New `votes` table (project_id, voter_id, event_id) + `POST /api/projects/{id}/vote` | Reuse `requireUser()`; one vote per user per project via unique index |
| Comments | New `comments` table keyed by project | Moderation flag + `deleted_at`; same soft-delete pattern as `projects` |
| Randomized gallery ordering | `GET /api/gallery` | Currently `ORDER BY submitted_at DESC`; add `order=random` with a per-session seed |
| Rate limiting (general) | `src/lib/auth/throttle.ts` pattern | Login throttling already exists; generalize keys (`u:<id>:<action>`) |
| Duplicate detection | `projects` insert/submit | Compare normalized `repo_url`; add a partial unique index or a warning |
| Audit query | New `audit_events` table (append-only) | Write from submit, score, export, role changes; read-only organizer endpoint |

## T4 — platform and ecosystem

| Feature | Attaches to | Notes |
| --- | --- | --- |
| Documented REST API | Existing `/api/*` routes | Add an OpenAPI file generated from the Zod schemas in `src/lib/**/input.ts` / route files |
| Webhooks | After-commit hook in submit / publish routes | Outbox table + worker; sign payloads with HMAC |
| Certificates / signed records | Results endpoint | Sign `{event, project, rank}` with an Ed25519 key kept outside git |
| Embed widget | `/gallery` | Add an embeddable, iframe-safe variant with a restrictive CSP |
| Bulk import/export | `fixtures/importer.ts` (placeholder) and `/api/events/{id}/export` | CSV export exists for results; import is not implemented |
| Pairwise judging seam | `scores` / `judge_assignments` | A pairwise mode would add a `comparisons` table and a different aggregator in `src/lib/judging/` |
