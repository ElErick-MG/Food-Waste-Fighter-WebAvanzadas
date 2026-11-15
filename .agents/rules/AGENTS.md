# AGENTS.md — Food Waste Fighter Business Edition

## Project context

You are working on Food Waste Fighter Business Edition, an academic web application for small restaurants and cafeterias.

The project is a migration of an existing Java/JSP application into a Node.js monolith for the first academic bimester.

## Mandatory context

Before modifying any code:

1. Read `docs/1.Estado/contextoProyecto.md` for overall context.
2. Read `docs/3.Especificaciones/PROJECT_SPEC.md`.
3. Read `docs/4.Arquitectura/TECHNICAL_REFERENCE.md` for the current architecture, model and contracts.
4. Read `docs/1.Estado/PROGRESS.md` to understand the current state.
5. Inspect the relevant existing code before making changes.

Never assume unfinished work is complete.

## Technology constraints

For the first bimester, use:

- Node.js + Express
- EJS for server-rendered HTML
- MySQL + Prisma
- Socket.IO
- Argon2id and secure sessions
- Zod for validation
- Vitest + Supertest
- GitHub Codespaces + Docker Compose

Do not introduce React, a SPA or microservices during the first bimester.

Follow the original academic guide and `docs/3.Especificaciones/PROJECT_SPEC.md`.

## Development workflow

Work incrementally, focusing on one small, verifiable task at a time.

Before beginning a task:
- Inspect `docs/1.Estado/PROGRESS.md`.
- Choose the next pending task based on priority and dependencies.
- Mark the task as IN_PROGRESS.
- Inspect the files that will be affected.

After completing a task:
- Run relevant automated tests.
- Verify functionality when the environment permits.
- Record what was changed.
- Update `docs/1.Estado/PROGRESS.md`.
- Mark the task DONE only when verification is successful.
- Document errors and blockers truthfully.
- Identify the next pending task.

If work is interrupted, keep `docs/1.Estado/PROGRESS.md` accurate enough for another agent to continue.

## Quality requirements

- Never invent test results or claim unverified features work.
- Never hardcode passwords or credentials.
- Preserve useful business rules from the original project.
- Maintain modular architecture within a single monolith.
- Write readable, maintainable code.
- Do not introduce unnecessary dependencies.
- Do not remove existing functionality without documenting the reason.
- Prioritize mandatory rubric requirements before optional improvements.

## Codespaces

The project must run entirely inside GitHub Codespaces.

Maintain `.devcontainer/devcontainer.json`, Docker Compose configuration and `.env.example`.

Do not require local installations on the user's computer.

## Documentation

Keep `docs/1.Estado/PROGRESS.md` updated throughout development.

Update architectural documentation when architectural decisions change.

Document AI-assisted work appropriately.

## Important

The academic guide and project specification define WHAT must be built.

This file defines HOW the agent must work.

`docs/1.Estado/PROGRESS.md` defines WHAT HAS BEEN DONE and WHAT REMAINS.
