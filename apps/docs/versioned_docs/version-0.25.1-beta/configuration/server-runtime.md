---
sidebar_position: 4
title: Server & runtime
description: Core server settings, the encryption key, networking, logging, uploads and the scheduler.
---

# Server & runtime

Settings for the Norish server. Most have working defaults, but you must provide your own
`MASTER_KEY`.

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
Norish derives the keys that encrypt stored secrets from `MASTER_KEY`, so
changing it makes them unreadable. Generate one with:

```bash
openssl rand -base64 32
```

:::

## Networking & origins

| Variable          | Description                                | Default |
| ----------------- | ------------------------------------------ | ------- |
| `TRUSTED_ORIGINS` | Comma-separated additional trusted origins | (empty) |

Set `TRUSTED_ORIGINS` when people reach Norish on more than one address, for
example `http://192.168.1.100:3000,https://norish.example.com`. The WebSocket
refuses origins it doesn't trust, see
[Origin check](./websocket.md#origin-check).

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

Registration turns off after the first user signs in, see
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

| Variable                        | Description                                                                                                              | Default                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `INGREDIENT_CATALOGUE_URL`      | Where the ingredient catalogue seed is fetched from, nightly and at startup. Empty turns the fetch off                   | The Open Food Facts ingredients taxonomy |
| `INGREDIENT_REVIEW_CONCURRENCY` | How many ingredients are asked at once, from 1 to 50. Lower it when a self-hosted model struggles with parallel requests | `10`                                     |

Norish seeds its [ingredient catalogue](../groceries/ingredients.md) from the
[Open Food Facts](https://world.openfoodfacts.org) ingredients taxonomy and
refreshes it every night at midnight.

On a server without internet, serve a copy of `ingredients.txt` from a local
mirror and point `INGREDIENT_CATALOGUE_URL` at it, or leave it empty. Norish
works either way.

The taxonomy is under the
[Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
Download it under **Settings => Ingredients => Data sources**.
