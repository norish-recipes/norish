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
example `http://192.168.1.100:3000,https://norish.example.com`.

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
