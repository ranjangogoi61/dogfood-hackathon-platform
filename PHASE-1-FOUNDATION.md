# Dogfood – Phase 1 Foundation (Frozen)

**Status:** Ready for Implementation

## Purpose

Freeze the Phase 1 foundation before implementation.

## Locked Stack

- Next.js 15
- TypeScript (strict)
- PostgreSQL 16
- Drizzle ORM
- Zod
- Custom Sessions
- bcryptjs
- Docker Compose

## Environment

- Authoring: GitHub Web (Android)
- Verification: GitHub Codespaces
- Runtime: docker compose up

## Repository Structure

```text
dogfood/
├── package.json
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── .dockerignore
├── .dogfood.toml
├── vitest.config.ts
├── src/
├── scripts/
├── fixtures/
└── tests/
```

## Docker Architecture

Startup order:

1. PostgreSQL
2. db-init
3. app

## API Foundation

- GET /api/health
- GET /api/ready

## Honest Verification

Reviewed:
- Stack consistency
- Docker architecture
- Repository structure

Not claimed:
- docker compose up passed
- pnpm build passed
- run.py passed

## Upload

Commit message:

`docs: freeze Phase 1 foundation plan`

## Exit Criteria

- [ ] Repository structure exists
- [ ] Docker files committed
- [ ] Documentation committed
- [ ] Ready for Phase 2

**FOUNDATION FROZEN**
