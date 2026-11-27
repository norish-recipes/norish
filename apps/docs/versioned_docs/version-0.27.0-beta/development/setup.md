---
sidebar_position: 1
title: Development setup
description: Run Norish locally for development, in the devcontainer or on your machine.
---

# Development setup

Install the Node.js version in `.nvmrc`, pnpm 12, uv 0.13 or later, Docker and Git.

## Devcontainer

Open the repo in the devcontainer. It installs dependencies and starts PostgreSQL,
Valkey and Obscura.

```bash
cp .env.example .env.local
pnpm run dev
```

:::tip
To customise the devcontainer, copy `.devcontainer/default` to a new folder
next to it. Git only tracks `default`.
:::

## Locally

```bash
git clone https://github.com/norish-recipes/norish.git
cd norish

# Also installs the recipe parser's Python environment
pnpm install

cp .env.example .env.local

# Starts PostgreSQL, Valkey and Obscura
pnpm run docker:up

pnpm run dev
```

`.env.local` needs `DATABASE_URL`, `VALKEY_URL`, `AUTH_URL` and `MASTER_KEY`. See
[Server & runtime](../configuration/server-runtime.md).

## Contributing

See the commands, code style and pull request process in
[CONTRIBUTING.md](https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md).
