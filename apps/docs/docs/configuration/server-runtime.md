---
sidebar_position: 4
title: Server & runtime
description: Core server settings — encryption key, networking, logging, uploads, and the scheduler.
---

# Server & runtime

General settings for the Norish server process. Most have sensible defaults;
`MASTER_KEY` is the one you must set.

## Core

| Variable     | Description                                  | Default                                |
| ------------ | -------------------------------------------- | -------------------------------------- |
| `MASTER_KEY` | 32+ character key for encryption derivation  | (required)                             |
| `AUTH_URL`   | Public URL used for auth callbacks and links | `http://localhost:3000`                |
| `NODE_ENV`   | Runtime environment                          | `production` (set by the Docker image) |
| `HOST`       | Server bind address                          | `0.0.0.0`                              |
| `PORT`       | Server port                                  | `3000`                                 |
| `REDIS_URL`  | Redis connection URL for events and jobs     | `redis://localhost:6379`               |

:::info Generate a `MASTER_KEY`
`MASTER_KEY` derives the encryption keys used to protect stored secrets. Generate
a strong one and keep it stable — changing it invalidates previously encrypted
data:

```bash
openssl rand -base64 32
```

:::

## Networking & origins

| Variable          | Description                                | Default |
| ----------------- | ------------------------------------------ | ------- |
| `TRUSTED_ORIGINS` | Comma-separated additional trusted origins | (empty) |

`TRUSTED_ORIGINS` is useful when Norish is reached from more than one origin, for
example `http://192.168.1.100:3000,https://norish.example.com`. The WebSocket
refuses an upgrade from a browser origin it does not trust, so a proxy that
rewrites `Host` needs the public origin listed here when that origin is not the
one in `AUTH_URL` either — see
[WebSocket & realtime](./websocket.md#origin-check).

## Auth rate limiting

| Variable                  | Description                        | Default |
| ------------------------- | ---------------------------------- | ------- |
| `AUTH_RATE_LIMIT_ENABLED` | Enable auth endpoint rate limiting | `true`  |
| `AUTH_RATE_LIMIT_WINDOW`  | Window length in seconds           | `60`    |
| `AUTH_RATE_LIMIT_MAX`     | Requests allowed per window        | `20`    |

:::warning

Turning this off removes brute-force protection from sign-in.

:::

## Registration

| Variable              | Description                 | Default |
| --------------------- | --------------------------- | ------- |
| `ENABLE_REGISTRATION` | Allow new-user registration | `false` |

After the first user signs in, registration is disabled automatically. See
[Authentication](./authentication.md).

## Logging

| Variable                | Description                                      | Default |
| ----------------------- | ------------------------------------------------ | ------- |
| `NEXT_PUBLIC_LOG_LEVEL` | Log verbosity (`debug`, `info`, `warn`, `error`) | `info`  |

## Uploads

| Variable               | Description                    | Default                                           |
| ---------------------- | ------------------------------ | ------------------------------------------------- |
| `UPLOADS_DIR`          | Upload storage directory       | `./.runtime/uploads` (dev), `/app/uploads` (prod) |
| `MAX_AVATAR_FILE_SIZE` | Max avatar upload size (bytes) | `5242880`                                         |
| `MAX_IMAGE_FILE_SIZE`  | Max image upload size (bytes)  | `10485760`                                        |
| `MAX_VIDEO_FILE_SIZE`  | Max video upload size (bytes)  | `104857600`                                       |

## Scheduler

| Variable                   | Description                        | Default |
| -------------------------- | ---------------------------------- | ------- |
| `SCHEDULER_CLEANUP_MONTHS` | Cleanup retention period in months | `3`     |

## Ingredient catalogue

| Variable                        | Description                                                                                                                                                             | Default                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `INGREDIENT_CATALOGUE_URL`      | Where the ingredient catalogue seed is fetched from, nightly and at startup. Empty turns the fetch off                                                                  | The Open Food Facts ingredients taxonomy |
| `INGREDIENT_REVIEW_CONCURRENCY` | How many ingredients a round of **Ask AI** on the Ingredients page asks about at once, from 1 to 50. Lower it when a self-hosted model struggles with parallel requests | `10`                                     |

Norish seeds its catalogue of ingredients from the [Open Food Facts](https://world.openfoodfacts.org) ingredients taxonomy, so a new instance already knows that "ui", "oignon" and "onion" are one food. A new instance fetches and applies the file before it starts serving, so its first import already knows the catalogue; after that the file is fetched at every startup and every night at midnight, and only when it changed. A failed or malformed fetch keeps the last good seed and shows as a failed job in the job monitor.

On a server without internet, serve a copy of `ingredients.txt` from a local mirror and point `INGREDIENT_CATALOGUE_URL` at it, or set it empty: Norish works without a seed, it only recognises fewer spellings of a food on its own.

The taxonomy is available under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). Every signed-in user can download the catalogue Norish builds from it under **Settings → Ingredients → Data sources**.
