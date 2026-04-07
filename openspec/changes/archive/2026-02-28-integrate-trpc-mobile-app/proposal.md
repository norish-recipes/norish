## Why

The mobile app currently has no runtime-configurable backend URL, so it cannot reliably reach the backend from simulator/device environments where localhost and host mapping vary. We need an explicit first-run connection setup so mobile can discover and persist the base URL before initializing API usage.

## What Changes

- Add a first-run backend connection screen with a HeroUI card, base URL input, and a `Connect` action.
- Validate connectivity by calling `GET /api/health` before persisting the URL.
- Persist the selected backend base URL in secure device storage.
- Route app startup to the connection screen when no base URL is saved; otherwise skip setup and continue to the app.
- Add base URL helpers that produce the tRPC endpoint URL at `/api/trpc`.

## Capabilities

### New Capabilities

- `mobile-trpc-integration`: Mobile backend base URL onboarding and persistence for future tRPC client initialization.

### Modified Capabilities

- None.

## Impact

- Affected code: `apps/mobile` routing, startup flow, and networking utility modules.
- Affected APIs: `GET /api/health` for connection testing and `/api/trpc` endpoint composition.
- Dependencies: mobile secure storage package for persisted backend URL.
