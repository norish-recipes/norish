## ADDED Requirements

### Requirement: Repository Modules Preserve One-Way Infrastructure Dependencies

Database repository modules SHALL remain infrastructure-layer modules and SHALL NOT import service-layer entry points from sibling domains (for example `@norish/auth/*`, `@norish/api/*`, or `@norish/config/server-config-loader`).

#### Scenario: Repository import graph avoids service-layer back edges

- **WHEN** a repository module under `packages/db/src/repositories/**` is inspected
- **THEN** its imports SHALL be limited to database schema, drizzle access, shared contracts/utilities, and sibling repository helpers
- **AND** it SHALL NOT import service-layer modules that themselves depend on configuration or repository aggregation.

### Requirement: Config Loaders Use Scoped Repository Access

Configuration loader modules SHALL import only the specific repository module(s) required for config persistence and SHALL NOT depend on broad repository barrels that aggregate unrelated repository concerns.

#### Scenario: Server config loader avoids repository barrel fan-in

- **WHEN** `packages/config/src/server-config-loader.ts` reads or writes server config values
- **THEN** it SHALL use scoped imports for server-config data access
- **AND** it SHALL NOT import `@norish/db/repositories` barrel exports.
