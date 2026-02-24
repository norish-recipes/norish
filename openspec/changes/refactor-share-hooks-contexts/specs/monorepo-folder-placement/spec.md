## MODIFIED Requirements

### Requirement: Canonical Destination Rules for Product Source Folders

The plan SHALL define canonical destination rules so source folders are migrated consistently into `apps/*` and `packages/*` without ad-hoc placement.

#### Scenario: Product folders map to stable monorepo targets

- **WHEN** source code folders are migrated
- **THEN** `app`, `components`, `stores`, `styles`, and `public` modules SHALL be placed under `apps/web`
- **AND** hooks and contexts classified as runtime-safe or adapter-required SHALL be placed under shared package(s) in `packages/*`
- **AND** hooks and contexts classified as web-only SHALL remain under `apps/web`
- **AND** shared `i18n` catalogs/helpers SHALL be placed in `packages/i18n`, with app runtime adapter modules remaining in `apps/web`
- **AND** backend modules from `server` and server-side portions of `config` and `lib` SHALL be placed under backend packages in `packages/*`
- **AND** cross-runtime contracts from `types` SHALL be placed in shared package(s) that do not import backend internals
- **AND** DTO-defining Zod schemas (currently in `server/db/zodSchemas/`) that serve as the single source of truth for shared contract types SHALL be co-located in the shared package alongside their inferred TypeScript types, so that DTO types remain `z.output<>` derivations rather than manually duplicated interfaces
- **AND** backend-only runtime types (for example queue/job contracts coupled to backend libraries) SHALL remain in their owning backend package(s) and SHALL NOT be moved into shared contracts
