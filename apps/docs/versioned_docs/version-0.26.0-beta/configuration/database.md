---
sidebar_position: 3
title: Database
description: Connect Norish to PostgreSQL.
---

# Database

Set `DATABASE_URL` to connect to **PostgreSQL**:

```yaml title="docker-compose.yml (environment)"
DATABASE_URL: postgres://postgres:norish@db:5432/norish
```

| Variable       | Description                  | Example                               |
| -------------- | ---------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@db:5432/norish` |

## Separate variables

Without `DATABASE_URL`, the connection uses the variables below. With
none set, it defaults to `postgresql://postgres:norish@localhost:5432/norish`.

| Variable            | Description       | Default     |
| ------------------- | ----------------- | ----------- |
| `DATABASE_HOST`     | PostgreSQL host   | `localhost` |
| `DATABASE_PORT`     | PostgreSQL port   | `5432`      |
| `DATABASE`          | Database name     | `norish`    |
| `DATABASE_USER`     | Database username | `postgres`  |
| `DATABASE_PASSWORD` | Database password | `norish`    |
