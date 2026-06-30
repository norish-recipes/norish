---
sidebar_position: 3
title: Database
description: Configure Norish's PostgreSQL connection.
---

# Database

Norish stores everything in **PostgreSQL**. Point it at your database with a
single `DATABASE_URL`:

```yaml title="docker-compose.yml (environment)"
DATABASE_URL: postgres://postgres:norish@db:5432/norish
```

| Variable       | Description                  | Example                               |
| -------------- | --------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@db:5432/norish` |

## Composing the URL from parts

If `DATABASE_URL` is not set, Norish composes it from the component variables
below. Use this only if you intentionally prefer split variables over a single
URL.

When no component vars are set either, the fallback URL is
`postgresql://postgres:norish@localhost:5432/norish`.

| Variable            | Description       | Default     |
| ------------------- | ----------------- | ----------- |
| `DATABASE_HOST`     | PostgreSQL host   | `localhost` |
| `DATABASE_PORT`     | PostgreSQL port   | `5432`      |
| `DATABASE`          | Database name     | `norish`    |
| `DATABASE_USER`     | Database username | `postgres`  |
| `DATABASE_PASSWORD` | Database password | `norish`    |

:::tip
For local development the default is a direct URL in `.env.local`, typically
`postgres://postgres:norish@localhost:5432/norish`.
:::
