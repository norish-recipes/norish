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
  - [Development Setup](#development-setup)
    - [Devcontainer Development](#devcontainer-development)
    - [Local Development](#local-development)
    - [Development Commands](#development-commands)
  - [Recipe API](#recipe-api)
  - [Tech Stack](#tech-stack)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [Database](#database)
    - [AI and Processing](#ai-and-processing)
    - [Testing and Tooling](#testing-and-tooling)
  - [License](#license)
  - [FOSS Alternatives](#foss-alternatives)
- [Nora](#nora)

---

## Vision

The vision for Norish is a shared recipe app built for friends, families, and households that want to share a recipe catalogue.

The name comes from Nora (our dog) + dish. Coincidentally, it also sounds like "nourish".

---

## Why Norish

Norish started because we wanted a cooking app that felt intuitive and easy to use. The existing apps we tested sadly did not meet our requirements in ease of use and aestethics.

Norish is intentionally minimal. It focuses on practical day-to-day use.

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
- **Internationalization (i18n)** currently supporting EN, NL, DE, FR, ES, RU, KO, PL, DA, and IT

_Note: AI feature speed can vary by provider, model, and region._

---

## Deploying

### Minimal Docker Compose

For a full template, see [docker-compose.example.yml](docker/docker-compose.example.yml).

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
      UPLOADS_DIR: /app/uploads

      # Optional
      # NEXT_PUBLIC_LOG_LEVEL: info
      # TRUSTED_ORIGINS: http://192.168.1.100:3000,https://norish.example.com
      # YT_DLP_BIN_DIR: /app/bin

      # First-user auth setup (choose one)
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
        [
          "CMD-SHELL",
          'node -e "require(''http'').get(''http://localhost:3000/api/v1/health'', r => process.exit(r.statusCode===200?0:1))"',
        ]
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

### Optional: compose `DATABASE_URL` from parts

By default, set `DATABASE_URL` directly.

If `DATABASE_URL` is not set, Norish composes it from optional component vars.
Use this only if you intentionally prefer split variables over a single URL.

For local development, the default setup is still a direct URL in `.env.local`, typically:
`DATABASE_URL=postgres://postgres:norish@localhost:5432/norish`

When no component vars are set, the fallback URL is:
`postgresql://postgres:norish@localhost:5432/norish`

| Variable            | Description       | Default     |
| ------------------- | ----------------- | ----------- |
| `DATABASE_HOST`     | PostgreSQL host   | `localhost` |
| `DATABASE_PORT`     | PostgreSQL port   | `5432`      |
| `DATABASE`          | Database name     | `norish`    |
| `DATABASE_USER`     | Database username | `postgres`  |
| `DATABASE_PASSWORD` | Database password | `norish`    |

### Commonly set in production

| Variable             | Description                                    | Typical value                |
| -------------------- | ---------------------------------------------- | ---------------------------- |
| `AUTH_URL`           | Public URL used for callbacks and links        | `https://norish.example.com` |
| `CHROME_WS_ENDPOINT` | Playwright CDP WebSocket endpoint for scraping | `ws://chrome-headless:3000`  |
| `REDIS_URL`          | Redis connection URL for events and jobs       | `redis://redis:6379`         |

### Optional general Runtime

| Variable              | Description                                | Default                                           |
| --------------------- | ------------------------------------------ | ------------------------------------------------- |
| `NODE_ENV`            | Runtime environment                        | `development`                                     |
| `HOST`                | Server bind address                        | `0.0.0.0`                                         |
| `PORT`                | Server port                                | `3000`                                            |
| `AUTH_URL`            | Public URL for auth callbacks and links    | `http://localhost:3000`                           |
| `TRUSTED_ORIGINS`     | Comma-separated additional trusted origins | (empty)                                           |
| `UPLOADS_DIR`         | Upload storage directory                   | `./.runtime/uploads` (dev), `/app/uploads` (prod) |
| `CHROME_WS_ENDPOINT`  | Playwright CDP WebSocket endpoint          | `ws://chrome-headless:3000`                       |
| `PARSER_API_TIMEOUT_MS` | Parser API timeout in milliseconds       | `15000`                                           |
| `LEGACY_RECIPE_PARSER_ROLLBACK` | Re-enable deprecated legacy structured parser | `false`                        |
| `REDIS_URL`           | Redis connection URL                       | `redis://localhost:6379`                          |
| `ENABLE_REGISTRATION` | Allow new-user registration                | `false`                                           |
| `AI_ENABLED`          | Enable AI features globally                | `false`                                           |

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
| `AI_TIMEOUT_MS`  | Maximum time for AI response (ms)  | `300000`     |

### Optional Video + Transcription

| Variable                   | Description                                     | Default                                   |
| -------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `VIDEO_PARSING_ENABLED`    | Enable video parsing pipeline                   | `false`                                   |
| `VIDEO_MAX_LENGTH_SECONDS` | Maximum accepted video length                   | `120`                                     |
| `YT_DLP_VERSION`           | yt-dlp version used by downloader               | `2025.11.12`                              |
| `YT_DLP_BIN_DIR`           | Folder containing yt-dlp binary                 | `./.runtime/bin` (dev), `/app/bin` (prod) |
| `TRANSCRIPTION_PROVIDER`   | Transcription provider                          | `disabled`                                |
| `TRANSCRIPTION_ENDPOINT`   | Transcription endpoint (local/custom providers) | (empty)                                   |
| `TRANSCRIPTION_API_KEY`    | Transcription API key                           | (empty)                                   |
| `TRANSCRIPTION_MODEL`      | Transcription model                             | `whisper-1`                               |

### Optional (Parsing + Content Detection)

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override units dictionary                       | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |

### Parser Rollout And Rollback

- Default non-video URL imports use the Python parser API first.
- By default, the custom Node server starts and supervises an embedded parser at `http://127.0.0.1:8001`.
- Norish always talks to the parser on that fixed internal loopback address.
- Set `LEGACY_RECIPE_PARSER_ROLLBACK=true` and restart Norish to switch structured imports back to the deprecated JSON-LD and microdata parser.
- Reset `LEGACY_RECIPE_PARSER_ROLLBACK=false` after the parser API is healthy again.
- Parser failure-code mapping and dependency upgrade workflow live in `apps/parser-api/README.md`.

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

## Development Setup

### Devcontainer Development

```bash
# Open the repository in the provided devcontainer
# Dependencies are installed automatically via postCreateCommand

# Create your environment file
cp .env.example .env.local

# Run the web app
pnpm run dev

# Run the mobile app (Expo)
pnpm run dev:mobile
```

### Devcontainer Additional Information

- The devcontainer starts the required dependency services (`db`, `redis`, and `chrome-headless`) for you, so you do not need to run `pnpm run docker:up`.
- If you want to edit the devcontainer settings just make a copy of the default folder, all folders inside .devcontainers are untracked, except default of course.

### Local Development

```bash
# Clone the repository
git clone https://github.com/norish-recipes/norish.git
cd norish

# Install dependencies
pnpm install

# This also runs uv sync --locked in apps/parser-api and creates its .venv

# Create your environment file
cp .env.example .env.local

# Start required services (Postgres, Redis, Chrome)
pnpm run docker:up

# Run the web app (it also starts the embedded parser from apps/parser-api/.venv)
pnpm run dev

# Run the mobile app (Expo)
pnpm run dev:mobile
```

### Development Commands

| Command                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Start development server with hot reload                  |
| `pnpm run dev:mobile`    | Start Expo mobile workspace (`apps/mobile`)               |
| `pnpm run build:web`     | Build Next.js app workspace (`apps/web`)                  |
| `pnpm run build`         | Full production build (Next.js + server + service worker) |
| `pnpm run test`          | Run tests via Turbo across all workspaces                 |
| `pnpm run test:run`      | Run tests once via Turbo                                  |
| `pnpm run test:coverage` | Run tests with coverage report                            |
| `pnpm run lint`          | Check for linting errors across all workspaces            |
| `pnpm run lint:check`    | Lint all workspaces and run monorepo integrity checks     |
| `pnpm run format`        | Check formatting across all workspaces (no auto-fix)      |
| `pnpm run typecheck`     | Run type checking across all workspaces                   |
| `pnpm run docker:up`     | Start local dependency stack via Compose                  |
| `pnpm run docker:down`   | Stop local dependency stack                               |

---

## API

Norish exposes an API under `/api/v1`.

- Visual docs: `/api/docs`
- OpenAPI spec JSON: `/api/openapi.json`
- Current endpoints:
  - `GET /api/v1/health` - Public health check for the API and internal parser service.
  - `GET /api/v1/recipes/{id}`
  - `POST /api/v1/recipes/search` - List recipes with optional filters.
  - `POST /api/v1/recipes/import/url`
  - `POST /api/v1/recipes/import/paste`
  - `GET /api/v1/groceries`
  - `POST /api/v1/groceries`
  - `PATCH /api/v1/groceries/{id}/done`
  - `PATCH /api/v1/groceries/{id}/undone`
  - `PATCH /api/v1/groceries/{id}/store`
  - `DELETE /api/v1/groceries/{id}`
  - `GET /api/v1/stores`
  - `POST /api/v1/stores`
  - `GET /api/v1/planned-recipes/today`
  - `GET /api/v1/planned-recipes/week`
  - `GET /api/v1/planned-recipes/month`
  - `POST /api/v1/planned-recipes`
  - `DELETE /api/v1/planned-recipes/{itemId}`

Authentication:

- `x-api-key: <your-api-key>`
- `Authorization: Bearer <your-api-key>`

Notes:

- `/api/docs` and `/api/openapi.json` require a signed-in web session.
- `GET /api/v1/health` is public and returns `200` only when the API and parser service are both healthy.
- Other documented `/api/v1` endpoints require API credentials.
- `POST /api/v1/recipes/search` returns a paginated recipe list. Optional filters include `search`, `searchFields`, `tags`, `categories`, `filterMode`, `sortMode`, `minRating`, and `maxCookingTime`. `cursor` defaults to `0` and `limit` defaults to `50`.
- Grocery mutation endpoints that target a single grocery require a `version` field for optimistic concurrency.
- `PATCH /api/v1/groceries/{id}/store` accepts `storeId` and optional `savePreference` in the request body.
- Planned recipe range endpoints use the server timezone for today/week/month boundaries. The week range is Monday through Sunday.

---

## Tech Stack

### Frontend

- Web: Next.js 16 App Router, React 19, HeroUI v2, Tailwind CSS v4, Motion, TanStack Query
- Mobile: Expo SDK 55, Expo Router, React Native 0.83, React 19, HeroUI Native v1 RC3, Uniwind, Tailwind CSS v4 theme tokens

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

## FOSS Alternatives

This list is not limited to the below but the ones I know:

- [Mealie](https://mealie.io/)
- [Tandoor](https://tandoor.dev/)

---

# Nora

Last but not least, a picture of our lovely dog Nora:

<img src="./apps/web/public/nora.jpg" width="25%" alt="Nora" />
