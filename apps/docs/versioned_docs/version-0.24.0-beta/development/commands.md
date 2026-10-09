---
sidebar_position: 2
title: Development commands
description: The pnpm scripts used during Norish development.
---

# Development commands

These run from the repository root and orchestrate the monorepo via Turbo.

| Command                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Start development server with hot reload                  |
| `pnpm run dev:mobile`    | Start Expo mobile workspace (`apps/mobile`)               |
| `pnpm run build:web`     | Build the Next.js app workspace (`apps/web`)              |
| `pnpm run build`         | Full production build (Next.js + server + service worker) |
| `pnpm run test`          | Run tests via Turbo across all workspaces                 |
| `pnpm run test:run`      | Run tests once via Turbo                                  |
| `pnpm run test:coverage` | Run tests with a coverage report                          |
| `pnpm run lint`          | Check for linting errors across all workspaces            |
| `pnpm run lint:check`    | Lint all workspaces and run monorepo integrity checks     |
| `pnpm run format`        | Check formatting across all workspaces (no auto-fix)      |
| `pnpm run typecheck`     | Run type checking across all workspaces                   |
| `pnpm run i18n:check`    | Check for missing locale keys                             |
| `pnpm run db:push`       | Push schema changes to the database                       |
| `pnpm run docker:up`     | Start the local dependency stack via Compose              |
| `pnpm run docker:down`   | Stop the local dependency stack                           |
