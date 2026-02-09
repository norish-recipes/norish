# Change: Add Site Authentication Tokens for Data Fetching

## Why

Several recipe and video sources (e.g., Instagram, Facebook) require authentication to access content. Users currently cannot provide site-specific credentials, causing imports to fail on protected or age-gated content. Users need a way to configure per-domain headers and cookies that are injected into Playwright browser contexts and yt-dlp commands during import.

## What Changes

- **New database table** `site_auth_tokens` storing per-user domain/name/value/type entries with encrypted values
- **New tRPC router** for CRUD operations on site auth tokens
- **New user settings section** in the UI for managing site auth tokens (domain, name, value, header/cookie type)
- **Playwright integration** in `server/parser/fetch.ts` to inject matching user tokens as extra HTTP headers or browser cookies when fetching URLs
- **yt-dlp integration** in `server/video/yt-dlp.ts` to pass matching user tokens via `--add-header` and `--cookies` flags
- **Import pipeline update** to thread user tokens from the job context through to fetch/download functions
- **i18n** keys for all new UI strings across all supported locales (en, nl, fr, de-formal, de-informal)
- **Full test coverage** for token repository, tRPC procedures, matching logic, injection into Playwright/yt-dlp, and UI components

## Impact

- Affected specs: `site-auth-tokens` (new), `video-import` (modified)
- Affected code:
  - `server/db/schema/` — new `site-auth-tokens.ts` table
  - `server/db/repositories/` — new `site-auth-tokens.ts` repository
  - `server/trpc/routers/` — new `site-auth-tokens/` router
  - `server/parser/fetch.ts` — inject headers/cookies into Playwright context
  - `server/video/yt-dlp.ts` — append `--add-header`/`--cookies` to yt-dlp args
  - `server/queue/recipe-import/worker.ts` — load user tokens and pass to fetch functions
  - `app/(app)/settings/user/` — new site auth tokens management card
  - `i18n/messages/*/settings.json` — new translation keys
