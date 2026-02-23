# Root-Invoked Script Ownership Inventory

| Root command | Classification | Implementation |
| --- | --- | --- |
| `deps:cycles` | monorepo-control | `tooling/monorepo/scripts/check-circular-deps.mjs` |
| `deps:workspace` | monorepo-control | `tooling/monorepo/scripts/check-workspace-dependencies.mjs` |
| `hygiene:root` | monorepo-control | `tooling/monorepo/scripts/check-root-hygiene.mjs` |
| `update-sw` | app-owned (`@norish/web`) | `apps/web/scripts/update-sw-version.js` |
| `i18n:check` | package-owned (`@norish/i18n`) | `packages/i18n/scripts/check-locale-keys.js` |
