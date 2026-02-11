<p align="center">
  <img src="./.github/assets/mockup-norish.png" width="100%" alt="Norish mockup" />
</p>

<p align="center">
  <a href="https://github.com/norish-recipes/Norish/blob/main/LICENSE"><img src="https://img.shields.io/github/license/norish-recipes/Norish?style=for-the-badge" alt="License" /></a>
  <a href="https://github.com/norish-recipes/Norish/actions"><img src="https://img.shields.io/github/actions/workflow/status/norish-recipes/Norish/release-build.yml?style=for-the-badge&logo=github" alt="Build Status" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/pulls/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Pulls" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/image-size/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Image Size" /></a>
  <a href="https://buymeacoffee.com/mikevanes"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<p align="center"><a href="https://imgur.com/a/07VpBIc">Demo video</a></p>

---

# Norish

Norish is a real-time, household-first recipe app for planning meals, sharing groceries, and cooking together.

## Table of Contents

- [Norish](#norish)
  - [Table of Contents](#table-of-contents)
  - [Vision](#vision)
  - [Why Norish](#why-norish)
  - [Core Features](#core-features)
  - [Deploying](#deploying)
    - [Minimal Docker Compose](#minimal-docker-compose)
    - [First-User Setup](#first-user-setup)
  - [Admin Settings](#admin-settings)
  - [Environment Variables](#environment-variables)
    - [Required by schema](#required-by-schema)
    - [Commonly set in production](#commonly-set-in-production)
    - [Optional general Runtime](#optional-general-runtime)
    - [Optional auth setup](#optional-auth-setup)
    - [Optional OIDC Claim Mapping](#optional-oidc-claim-mapping)
    - [Optional AI Provider](#optional-ai-provider)
    - [Optional Video + Transcription](#optional-video--transcription)
    - [Optional (Parsing + Content Detection)](#optional-parsing--content-detection)
    - [Optional (Scheduler + Upload Limits)](#optional-scheduler--upload-limits)
    - [Optional (Internationalization)](#optional-internationalization)
  - [Local Development](#local-development)
    - [Development Commands](#development-commands)
  - [Tech Stack](#tech-stack)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [Database](#database)
    - [AI and Processing](#ai-and-processing)
    - [Testing and Tooling](#testing-and-tooling)
  - [License](#license)
  - [Alternatives](#alternatives)
- [Nora](#nora)

---

## Vision

The vision for Norish is a shared recipe app built for friends, families, and households that want one collaborative recipe catalog.

The name comes from Nora (our dog) + dish. Coincidentally, it also sounds like "nourish".

---

## Why Norish

Norish started because we wanted a cooking app that felt lightweight, collaborative, and truly real-time while shopping and planning together.

Norish is intentionally minimal. It focuses on practical day-to-day planning.

---

## Core Features

- **Easy recipe import** from URL, with AI fallback if configured.
- **Video recipe import** from YouTube Shorts, Instagram Reels, TikTok, and more (requires AI provider).
- **Image recipe import** from screenshots/photos of recipes (requires AI provider).
- **Nutritional information** generation (requires AI provider).
- **Allergy detection and warnings** for recipe ingredients (detection requires AI provider).
- **Unit conversion** metric <-> US (requires AI provider).
- **Recurring groceries** via NLP or manual setup.
- **Real-time sync** of recipes, groceries, and meal planning data.
- **Households** with shared groceries and planning.
- **CalDAV sync** for calendar integration.
- **Mobile-first design** with light/dark mode support.
- **Authentication options**: OIDC, OAuth providers, and first-time password auth fallback.
- **Admin settings UI** for runtime configuration.
- **Permission policies** for recipe visibility/edit/delete scopes.
- **Internationalization (i18n)** currently supporting EN, NL and DE

_Note: AI feature speed can vary by provider, model, and region._

---

## Deploying

### Minimal Docker Compose

```yaml
services:
  norish:
    image: norishapp/norish:latest
    container_name: norish-app
    restart: always
    ports:
      - "3000:3000"
    user: "1000:1000"
    volumes:
      - norish_data:/app/uploads
    environment:
      AUTH_URL: http://norish.example.com
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: <32-byte-base64-key> # openssl rand -base64 32
      CHROME_WS_ENDPOINT: ws://chrome-headless:3000
      REDIS_URL: redis://redis:6379

      # Optional
      # NEXT_PUBLIC_LOG_LEVEL: info
      # TRUSTED_ORIGINS: http://192.168.1.100:3000,https://norish.example.com
      # YT_DLP_BIN_DIR: /app/bin

      # First-user auth setup (choose one)
      # PASSWORD_AUTH_ENABLED=false
      # OIDC_NAME: NoraId
      # OIDC_ISSUER: https://auth.example.com
      # OIDC_CLIENT_ID: <client-id>
      # OIDC_CLIENT_SECRET: <client-secret>
      # OIDC_WELLKNOWN: https://auth.example.com/.well-known/openid-configuration
      # GITHUB_CLIENT_ID: <github-client-id>
      # GITHUB_CLIENT_SECRET: <github-client-secret>
      # GOOGLE_CLIENT_ID: <google-client-id>
      # GOOGLE_CLIENT_SECRET: <google-client-secret>
    healthcheck:
      test:
        ["CMD", "curl", "--silent", "--show-error", "--fail", "http://localhost:3000/api/health"]
      interval: 1m
      timeout: 15s
      retries: 3
      start_period: 1m
    depends_on:
      - db
      - redis

  db:
    image: postgres:17-alpine
    container_name: norish-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: norish
      POSTGRES_DB: norish
    volumes:
      - db_data:/var/lib/postgresql/data

  chrome-headless:
    image: zenika/alpine-chrome:latest
    container_name: chrome-headless
    restart: unless-stopped
    command:
      - "--no-sandbox"
      - "--disable-gpu"
      - "--disable-dev-shm-usage"
      - "--remote-debugging-address=0.0.0.0"
      - "--remote-debugging-port=3000"
      - "--headless"

  redis:
    image: redis:8.4.0
    container_name: norish-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  db_data:
  norish_data:
  redis_data:
```

### First-User Setup

The first user to sign in becomes server owner + server admin. After first sign-in:

- User registration is disabled automatically.
- Ongoing server settings are managed in `Settings -> Admin`.

---

## Admin Settings

Server owners/admins can manage:

- Registration policy.
- Permission policies for recipe view/edit/delete.
- Auth providers (OIDC, GitHub, Google).
- OIDC claim mapping for admin role assignment + household auto-join.
- Content detection settings (units, content indicators, recurrence config).
- AI + video processing settings.
- System scheduler and server restart actions.

---

## Environment Variables

`env-config-server.ts` is the source of truth for runtime env vars.

### Required by schema

| Variable       | Description                                 | Example                               |
| -------------- | ------------------------------------------- | ------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string                | `postgres://user:pass@db:5432/norish` |
| `MASTER_KEY`   | 32+ character key for encryption derivation | `openssl rand -base64 32`             |

### Commonly set in production

| Variable             | Description                                    | Typical value                |
| -------------------- | ---------------------------------------------- | ---------------------------- |
| `AUTH_URL`           | Public URL used for callbacks and links        | `https://norish.example.com` |
| `CHROME_WS_ENDPOINT` | Playwright CDP WebSocket endpoint for scraping | `ws://chrome-headless:3000`  |
| `REDIS_URL`          | Redis connection URL for events and jobs       | `redis://redis:6379`         |

### Optional general Runtime

| Variable              | Description                                | Default                     |
| --------------------- | ------------------------------------------ | --------------------------- |
| `NODE_ENV`            | Runtime environment                        | `development`               |
| `HOST`                | Server bind address                        | `0.0.0.0`                   |
| `PORT`                | Server port                                | `3000`                      |
| `AUTH_URL`            | Public URL for auth callbacks and links    | `http://localhost:3000`     |
| `TRUSTED_ORIGINS`     | Comma-separated additional trusted origins | (empty)                     |
| `UPLOADS_DIR`         | Upload storage directory                   | `./uploads`                 |
| `CHROME_WS_ENDPOINT`  | Playwright CDP WebSocket endpoint          | `ws://chrome-headless:3000` |
| `REDIS_URL`           | Redis connection URL                       | `redis://localhost:6379`    |
| `ENABLE_REGISTRATION` | Allow new-user registration                | `false`                     |
| `AI_ENABLED`          | Enable AI features globally                | `false`                     |

### Optional auth setup

Configure one provider for initial sign-in; after that, use `Settings -> Admin`.

Provider callback URLs:

| Provider | Callback URL                                                      |
| -------- | ----------------------------------------------------------------- |
| OIDC     | `https://example.norish-domain.com/api/auth/oauth2/callback/oidc` |
| GitHub   | `https://example.norish-domain.com/api/auth/callback/github`      |
| Google   | `https://example.norish-domain.com/api/auth/callback/google`      |

| Variable                | Description                                          | Default |
| ----------------------- | ---------------------------------------------------- | ------- |
| `PASSWORD_AUTH_ENABLED` | Enable email/password auth bootstrap                 | Auto    |
| `OIDC_NAME`             | Display name for OIDC provider                       | (empty) |
| `OIDC_ISSUER`           | OIDC issuer URL                                      | (empty) |
| `OIDC_CLIENT_ID`        | OIDC client id                                       | (empty) |
| `OIDC_CLIENT_SECRET`    | OIDC client secret                                   | (empty) |
| `OIDC_WELLKNOWN`        | OIDC well-known URL (derived from issuer if omitted) | Derived |
| `GITHUB_CLIENT_ID`      | GitHub OAuth client id                               | (empty) |
| `GITHUB_CLIENT_SECRET`  | GitHub OAuth client secret                           | (empty) |
| `GOOGLE_CLIENT_ID`      | Google OAuth client id                               | (empty) |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth client secret                           | (empty) |

### Optional OIDC Claim Mapping

These are only used when claim mapping is enabled.

| Variable                      | Description                                      | Default             |
| ----------------------------- | ------------------------------------------------ | ------------------- |
| `OIDC_CLAIM_MAPPING_ENABLED`  | Enable claim-based role and household assignment | `false`             |
| `OIDC_SCOPES`                 | Additional OIDC scopes (comma-separated)         | (empty)             |
| `OIDC_GROUPS_CLAIM`           | Claim name containing group memberships          | `groups`            |
| `OIDC_ADMIN_GROUP`            | Group name that grants server admin role         | `norish_admin`      |
| `OIDC_HOUSEHOLD_GROUP_PREFIX` | Prefix for household auto-join groups            | `norish_household_` |

### Optional AI Provider

| Variable         | Description                        | Default      |
| ---------------- | ---------------------------------- | ------------ |
| `AI_PROVIDER`    | AI provider                        | `openai`     |
| `AI_ENDPOINT`    | Custom provider endpoint           | (empty)      |
| `AI_MODEL`       | Default model                      | `gpt-5-mini` |
| `AI_API_KEY`     | API key for provider               | (empty)      |
| `AI_TEMPERATURE` | Generation temperature             | `1.0`        |
| `AI_MAX_TOKENS`  | Maximum tokens for model responses | `10000`      |

### Optional Video + Transcription

| Variable                   | Description                                     | Default       |
| -------------------------- | ----------------------------------------------- | ------------- |
| `VIDEO_PARSING_ENABLED`    | Enable video parsing pipeline                   | `false`       |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                   | `120`         |
| `YT_DLP_VERSION`           | yt-dlp version used by downloader               | `2025.11.12`  |
| `YT_DLP_BIN_DIR`           | Folder containing yt-dlp binary                 | env-dependent |
| `TRANSCRIPTION_PROVIDER`   | Transcription provider                          | `disabled`    |
| `TRANSCRIPTION_ENDPOINT`   | Transcription endpoint (local/custom providers) | (empty)       |
| `TRANSCRIPTION_API_KEY`    | Transcription API key                           | (empty)       |
| `TRANSCRIPTION_MODEL`      | Transcription model                             | `whisper-1`   |

### Optional (Parsing + Content Detection)

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override units dictionary                       | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |

### Optional (Scheduler + Upload Limits)

| Variable                   | Description                        | Default     |
| -------------------------- | ---------------------------------- | ----------- |
| `SCHEDULER_CLEANUP_MONTHS` | Cleanup retention period in months | `3`         |
| `MAX_AVATAR_FILE_SIZE`     | Max avatar upload size (bytes)     | `5242880`   |
| `MAX_IMAGE_FILE_SIZE`      | Max image upload size (bytes)      | `10485760`  |
| `MAX_VIDEO_FILE_SIZE`      | Max video upload size (bytes)      | `104857600` |

### Optional (Internationalization)

| Variable          | Description                             | Default       |
| ----------------- | --------------------------------------- | ------------- |
| `DEFAULT_LOCALE`  | Instance default locale                 | `en`          |
| `ENABLED_LOCALES` | Comma-separated list of enabled locales | (all enabled) |

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/mikeve97/norish.git
cd norish

# Install dependencies
pnpm install

# Create your environment file
cp .env.example .env.local

# Start required services (for example via Docker)
# docker run -d --name norish-db -e POSTGRES_PASSWORD=norish -e POSTGRES_DB=norish -p 5432:5432 postgres:17-alpine
# docker run -d --name norish-redis -p 6379:6379 redis:7-alpine

# Run the app
pnpm run dev
```

### Development Commands

| Command                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Start development server with hot reload                  |
| `pnpm run build`         | Full production build (Next.js + server + service worker) |
| `pnpm run test`          | Run tests in watch mode                                   |
| `pnpm run test:run`      | Run tests once                                            |
| `pnpm run test:coverage` | Run tests with coverage report                            |
| `pnpm run lint`          | Lint and auto-fix issues                                  |
| `pnpm run lint:check`    | Lint TypeScript files                                     |
| `pnpm run format`        | Format files with Prettier                                |
| `pnpm run format:check`  | Check formatting without changing files                   |

---

## Tech Stack

### Frontend

- Next.js 16
- Tailwind CSS 4
- HeroUI
- Framer Motion
- TanStack Query

### Backend

- Node.js custom server
- tRPC
- Better Auth
- Pino
- Redis
- BullMQ

### Database

- PostgreSQL
- Drizzle ORM

### AI and Processing

- OpenAI SDK
- Playwright
- yt-dlp
- Sharp
- FFmpeg

### Testing and Tooling

- Vitest

---

## License

Norish is licensed under [AGPL-3.0](LICENSE).

## Alternatives

- [Mealie](https://mealie.io/)
- [Tandoor](https://tandoor.dev/)

---

# Nora

Last but not least, a picture of our lovely dog Nora:

<img src="./public/nora.jpg" width="25%" alt="Nora" />
