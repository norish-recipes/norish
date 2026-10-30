---
sidebar_position: 4
title: Server & runtime
description: Core server settings, the encryption key, health checks, networking, logging, uploads and the scheduler.
---

# Server & runtime

Most server settings have working defaults. You must provide your own
`MASTER_KEY`.

## Core

| Variable     | Description                                                             | Default                                |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------- |
| `MASTER_KEY` | 32+ character key for encryption derivation                             | (required)                             |
| `AUTH_URL`   | Public URL used for auth callbacks and links                            | `http://localhost:3000`                |
| `NODE_ENV`   | Runtime environment                                                     | `production` (set by the Docker image) |
| `HOST`       | Server bind address                                                     | `0.0.0.0`                              |
| `PORT`       | Server port                                                             | `3000`                                 |
| `VALKEY_URL` | Valkey connection URL (`valkey://` or `valkeys://`) for events and jobs | (required)                             |

:::info Generate a `MASTER_KEY`
`MASTER_KEY` is used to derive encryption keys for stored secrets. Changing
it makes those secrets unreadable. Generate one with:

```bash
openssl rand -base64 32
```

:::

## Health checks

| Endpoint               | Answers 200 when                                                        | Use it for                                                      |
| ---------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| `/api/v1/health/live`  | The server responds and its parser answers                              | Restarting Norish: the image's healthcheck, Kubernetes liveness |
| `/api/v1/health/ready` | The database and Valkey answer; the parser is reported but never counts | Sending traffic: Kubernetes readiness, load balancers           |

`/api/v1/health` is deprecated and answers like `/api/v1/health/ready`. Point new probes at live or ready.

## Networking & origins

| Variable          | Description                                                | Default |
| ----------------- | ---------------------------------------------------------- | ------- |
| `TRUSTED_ORIGINS` | Comma-separated additional trusted origins                 | (empty) |
| `TRUSTED_PROXIES` | Comma-separated IPs or CIDR ranges of your reverse proxies | (empty) |

Set `TRUSTED_ORIGINS` when people use more than one server address, for
example `http://192.168.1.100:3000,https://norish.example.com`. The WebSocket
refuses origins it doesn't trust, see
[Origin check](./websocket.md#origin-check).

Set `TRUSTED_PROXIES` when the server sits behind more than one reverse proxy, such as
Cloudflare in front of Nginx Proxy Manager. List the address or range of every proxy; for
Cloudflare that is its [published ranges](https://www.cloudflare.com/ips/). Without it,
visitors share one rate limit for sign-in and session checks.
Behind a single proxy it is not needed.

Visitors are identified by the `X-Forwarded-For` header your proxy adds, so only
the proxy should be able to reach the app's port. A visitor who connects to the port directly can set that
header themselves and get a sign-in rate limit of their own.

## Base path

To serve the app under a path such as `https://example.com/norish`, build it with
`NEXT_PUBLIC_BASE_PATH`.

| Variable                | Description                     | Default           |
| ----------------------- | ------------------------------- | ----------------- |
| `NEXT_PUBLIC_BASE_PATH` | The path the image is built for | (empty, the root) |

The path is part of the build, so the published image serves the root. Build your own:

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_BASE_PATH=/norish \
  --build-arg NORISH_VERSION_REPORT_JSON="$(node tooling/monorepo/scripts/print-package-versions.mjs)" \
  -t norish:base-path .
```

Set `AUTH_URL` to the same address and path; a mismatch prevents startup:

```dotenv
AUTH_URL=https://example.com/norish
```

Have the proxy forward the path unchanged, WebSocket included:

```nginx
location /norish {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}
```

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

| Variable                        | Description                                                                                                     | Default                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `INGREDIENT_CATALOGUE_URL`      | Catalogue seed URL, fetched at startup and nightly. Empty disables fetching                                     | The Open Food Facts ingredients taxonomy |
| `INGREDIENT_REVIEW_CONCURRENCY` | Concurrent AI ingredient reviews (1–50). Lower this for self-hosted models that struggle with parallel requests | `10`                                     |

The [ingredient catalogue](../groceries/ingredients.md) is seeded from the
[Open Food Facts](https://world.openfoodfacts.org) ingredients taxonomy and
refreshed every night at midnight.

On a server without internet, serve a copy of `ingredients.txt` from a local
mirror and point `INGREDIENT_CATALOGUE_URL` at it.
