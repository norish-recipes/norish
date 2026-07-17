---
sidebar_position: 1
title: Development setup
description: Set up a local Norish development environment with the devcontainer or manually.
---

# Development setup

There are two supported ways to develop Norish: the provided **devcontainer**
(recommended — services are wired up for you) or a **local** setup.

## Prerequisites

- **Node.js** 22.22.0 (see `.nvmrc`)
- **pnpm** 10.x or later
- **Docker** (for PostgreSQL, Redis, and headless Chrome)
- **Git**

## Devcontainer development

Open the repository in the provided devcontainer — dependencies install
automatically via `postCreateCommand`.

```bash
# Create your environment file
cp .env.example .env.local

# Run the web app
pnpm run dev

# Run the mobile app (Expo)
pnpm run dev:mobile
```

The devcontainer starts the required dependency services (`db`, `redis`, and
`chrome-headless`) for you, so you do **not** need to run `pnpm run docker:up`.

:::tip
To customize devcontainer settings, copy the default folder — everything inside
`.devcontainers` is untracked except `default`.
:::

## Local development

```bash
# Clone the repository
git clone https://github.com/norish-recipes/norish.git
cd norish

# Install dependencies
# (this also runs `uv sync --locked` in apps/parser-api and creates its .venv)
pnpm install

# Create your environment file
cp .env.example .env.local

# Start required services (Postgres, Redis, Chrome)
pnpm run docker:up

# Run the web app (also starts the embedded parser from apps/parser-api/.venv)
pnpm run dev

# Run the mobile app (Expo)
pnpm run dev:mobile
```

At minimum, your `.env.local` needs `DATABASE_URL`, `REDIS_URL`, `AUTH_URL`, and
`MASTER_KEY` (generate the last with `openssl rand -base64 32`). See
[Server & runtime](../configuration/server-runtime.md) and
[Database](../configuration/database.md) for the full reference.

Next: the [development commands](./commands.md) and the
[contributing guide](./contributing.md).
