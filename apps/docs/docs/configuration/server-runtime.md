---
sidebar_position: 4
title: Server & runtime
description: Core server settings, the encryption key, health checks, networking, logging, uploads and the scheduler.
---

# Server & runtime

## Core

| Variable     | Description                                                             | Default                                |
| ------------ | ----------------------------------------------------------------------- | -------------------------------------- |
| `AUTH_URL`   | Public URL used for auth callbacks and links                            | `http://localhost:3000`                |
| `NODE_ENV`   | Runtime environment                                                     | `production` (set by the Docker image) |
| `HOST`       | Server bind address                                                     | `0.0.0.0`                              |
| `PORT`       | Server port                                                             | `3000`                                 |
| `VALKEY_URL` | Valkey connection URL (`valkey://` or `valkeys://`) for events and jobs | (required)                             |

## Master key

The Master Key protects encrypted data if the database alone is leaked. Norish
stores it outside the database. Leave `MASTER_KEY` unset or blank to generate a
key at `<UPLOADS_DIR>/.norish/master-key.json` on first start. To pin a key,
set `MASTER_KEY`. A key set for the first time, or a new rotation key, must be
base64; generate one with `openssl rand -base64 32`. A key the instance already
uses keeps working in its existing form. Back up the database and uploads volume
together. Run only one Norish process per database.

If the key is wrong or missing, Norish refuses to start and names the missing
key. Restore `MASTER_KEY` or the uploads volume from a backup. There is no reset.
If the instance ran under an earlier `MASTER_KEY`, put that key in
`MASTER_KEY_PREVIOUS` beside the current `MASTER_KEY`.

Session signing always derives from the Master Key. `BETTER_AUTH_SECRET` and
`BETTER_AUTH_SECRETS` have no effect.

### Rotate the master key

For a generated key, open **Admin**, then **System**, and select **Rotate master
key**. Confirm with **Rotate**. Configure your deployment to restart Norish
automatically, for example with `restart: always` in Compose.

![Rotate master key in System settings](/img/screenshots/admin-rotate-master-key-card.png)

![Rotate master key confirmation](/img/screenshots/admin-rotate-master-key.png)

For a pinned key, set `MASTER_KEY_PREVIOUS` to the current `MASTER_KEY` and set
`MASTER_KEY` to a new key. Restart Norish, then remove `MASTER_KEY_PREVIOUS`
after the rotating start succeeds. After pinning a key on an instance that used
a generated key, `<UPLOADS_DIR>/.norish/master-key.json` holds a retired key and
can be deleted; Norish logs its path and never deletes the file itself.

On the next start, Norish re-encrypts the data under the new key and ends every
session on web and mobile. Everyone must sign in again. Share links made before
0.28 stop working and can only be deleted. API keys keep working. If rotation
fails, Norish retries it on the next start.

## Database

Set `DATABASE_URL` to point Norish at PostgreSQL.

```yaml title="docker-compose.yml (environment)"
DATABASE_URL: postgres://postgres:norish@db:5432/norish
```

Leave `DATABASE_URL` unset to use these variables.

| Variable            | Default     |
| ------------------- | ----------- |
| `DATABASE_HOST`     | `localhost` |
| `DATABASE_PORT`     | `5432`      |
| `DATABASE`          | `norish`    |
| `DATABASE_USER`     | `postgres`  |
| `DATABASE_PASSWORD` | `norish`    |

## Health checks

- Use `/api/v1/health/live` to decide when to restart Norish.
- Use `/api/v1/health/ready` to decide when to send it traffic.

## Networking & origins

| Variable          | Description                                                | Default |
| ----------------- | ---------------------------------------------------------- | ------- |
| `TRUSTED_ORIGINS` | Comma-separated additional trusted origins                 | (empty) |
| `TRUSTED_PROXIES` | Comma-separated IPs or CIDR ranges of your reverse proxies | (empty) |

Set `TRUSTED_ORIGINS` if people use more than one address for Norish. See
[Origin check](#origin-check).

Behind multiple reverse proxies, list each proxy's IP address or range in
`TRUSTED_PROXIES` so visitors get separate rate limits. For Cloudflare, use
its [published ranges](https://www.cloudflare.com/ips/). Restrict access to
the app port to your proxy to prevent forged `X-Forwarded-For` headers.

## WebSocket & realtime

If changes appear only after a refresh, check that your proxy forwards
WebSocket upgrades to Norish at `/trpc`.

### nginx

```nginx
location / {
    proxy_pass         http://norish:3000;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
}
```

Keep `proxy_read_timeout` above 25 seconds.

### Caddy

```caddyfile
norish.example.com {
    reverse_proxy norish:3000
}
```

### Traefik

Traefik forwards upgrades by default. If you set
`respondingTimeouts.readTimeout`, keep it above 25 seconds.

### Origin check

For a WebSocket `403 Forbidden`, check that the origin matches `AUTH_URL`,
an entry in `TRUSTED_ORIGINS`, or the request host. If your proxy rewrites the
host and users connect at a different address, add that origin to
`TRUSTED_ORIGINS`.

## Private certificates

If CalDAV reports an untrusted certificate, verify its fingerprint before
choosing **Trust** for that connection.

To trust a private certificate authority in Norish, mount its certificate
and set `NODE_EXTRA_CA_CERTS`.

```yaml
services:
  norish:
    environment:
      NODE_EXTRA_CA_CERTS: /certs/my-ca.pem
    volumes:
      - ./my-ca.pem:/certs/my-ca.pem:ro
```

Norish passes only `PATH`, `HOME`, `LANG`, `LC_*`, `TZ`, `TMPDIR`,
`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` and the lower-case proxy forms to
yt-dlp, ffmpeg, ffprobe and the embedded parser. Other variables, including CA
bundle variables, do not reach those processes.

## Base path

Build a custom image to serve Norish under a path such as `/norish`.

```bash
docker build -f docker/Dockerfile \
  --build-arg NEXT_PUBLIC_BASE_PATH=/norish \
  --build-arg NORISH_VERSION_REPORT_JSON="$(node tooling/monorepo/scripts/print-package-versions.mjs)" \
  -t norish:base-path .
```

Set `AUTH_URL` to the same public address and path. A mismatch prevents startup.

```dotenv
AUTH_URL=https://example.com/norish
```

Forward the path unchanged through your proxy and allow WebSocket upgrades.

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

| Variable                    | Description                             | Default |
| --------------------------- | --------------------------------------- | ------- |
| `AUTH_RATE_LIMIT_ENABLED`   | Enable auth endpoint rate limiting      | `true`  |
| `AUTH_RATE_LIMIT_WINDOW`    | Window length in seconds                | `60`    |
| `AUTH_RATE_LIMIT_MAX`       | Requests allowed per window             | `20`    |
| `API_KEY_RATE_LIMIT_WINDOW` | API key window length in seconds        | `3600`  |
| `API_KEY_RATE_LIMIT_MAX`    | Requests allowed per API key per window | `500`   |

:::warning
Turning this off removes brute-force protection from sign-in.
:::

## Registration

Registration closes after the first sign-in. To reopen it, turn on
**Allow new user registration** under **General** in admin settings.

## Logging

Set `NEXT_PUBLIC_LOG_LEVEL` to `debug`, `info`, `warn` or `error`. The default is `info`.

## Uploads

| Variable               | Description                    | Default                                           |
| ---------------------- | ------------------------------ | ------------------------------------------------- |
| `UPLOADS_DIR`          | Upload storage directory       | `./.runtime/uploads` (dev), `/app/uploads` (prod) |
| `MAX_AVATAR_FILE_SIZE` | Max avatar upload size (bytes) | `5242880`                                         |
| `MAX_IMAGE_FILE_SIZE`  | Max image upload size (bytes)  | `10485760`                                        |
| `MAX_VIDEO_FILE_SIZE`  | Max video upload size (bytes)  | `104857600`                                       |

## Scheduler

Set `SCHEDULER_CLEANUP_MONTHS` to change the cleanup period. The default is three months.

## Ingredient catalogue

| Variable                        | Description                                                                                                     | Default                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `INGREDIENT_CATALOGUE_URL`      | Catalogue seed URL, fetched at startup and nightly. Empty disables fetching                                     | The Open Food Facts ingredients taxonomy |
| `INGREDIENT_REVIEW_CONCURRENCY` | Concurrent AI ingredient reviews (1–50). Lower this for self-hosted models that struggle with parallel requests | `10`                                     |

For a server without internet access, mirror `ingredients.txt` and point
`INGREDIENT_CATALOGUE_URL` at that copy.

## Languages

Choose languages under **General** in admin settings or set them in Compose.

| Variable          | Description                             | Default       |
| ----------------- | --------------------------------------- | ------------- |
| `DEFAULT_LOCALE`  | Instance default locale                 | `en`          |
| `ENABLED_LOCALES` | Comma-separated list of enabled locales | (all enabled) |

```yaml title="docker-compose.yml (environment)"
DEFAULT_LOCALE: en
ENABLED_LOCALES: en,nl,no
```

See the [supported language codes](https://github.com/norish-recipes/Norish/blob/main/packages/i18n/src/locales.ts).
