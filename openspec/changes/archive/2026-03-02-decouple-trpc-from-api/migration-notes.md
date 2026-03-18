## Boundary migration notes

### Final ownership decisions

- Added a new `@norish/shared-server` package for server-only utilities consumed by `@norish/trpc`.
- Kept `@norish/trpc` as router/procedure source-of-truth and removed all direct `@norish/api/*` imports under `packages/trpc/src/**`.
- Kept `@norish/api` as transport host (`/api/trpc/*` via Next route handling and websocket mount via `initTrpcWebSocket`).

### Utility homes moved for TRPC consumers

- Logger: `@norish/shared-server/logger`
- Media helpers: `@norish/shared-server/media/storage`, `@norish/shared-server/media/avatar-cleanup`
- Recipe randomizer: `@norish/shared-server/recipes/randomizer`
- Admin defaults helper: `@norish/shared-server/config/defaults`
- Archive parser stack: `@norish/shared-server/archive/parser`
- CalDAV client/sync entrypoints: `@norish/shared-server/caldav/client`, `@norish/shared-server/caldav/sync`
- AI helpers used by TRPC: `@norish/shared-server/ai/providers`, `@norish/shared-server/ai/unit-converter`

### Validation outcomes

- `pnpm run deps:cycles`: pass
- `pnpm run deps:workspace`: pass
- `pnpm run typecheck:mobile`: pass
- `pnpm run build`: pass
- Targeted smoke checks:
  - `NODE_ENV=development pnpm --filter @norish/auth test`: pass
  - `NODE_ENV=development pnpm --filter @norish/api exec vitest run --config ./vitest.config.ts __tests__/trpc/archive/archive-import-validation.test.ts __tests__/trpc/caldav/procedures.test.ts __tests__/trpc/admin/admin.test.ts`: pass

### Mobile `server-only` declaration

- Re-evaluated `apps/mobile/declarations.d.ts` after `typecheck:mobile`; no change applied in this migration.
