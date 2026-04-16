## Why

Norish now has the backend and shared-react primitives for public recipe sharing, but the web app still has no way to create or manage share links or render the anonymous shared recipe page. This leaves the feature incomplete for users and operators, and it also keeps new UI work mixed into an already failing web unit-test baseline.

## What Changes

- Add web recipe-detail share management that opens from the recipe page into a bottom panel for creating links, listing current links, copying newly created URLs, and revoking/reactivating/deleting links.
- Add a user settings share-link management table that shows all of the current user's recipe share links with lifecycle status and revoke/reactivate/delete actions.
- Add an admin settings share-link management surface that shows share links across the instance with lifecycle actions and owner/recipe visibility for moderation and support.
- Add a readonly public share page at `/share/[token]` that stays outside the authenticated `(app)` route group, reuses recipe detail building blocks, omits authenticated-only controls, and removes the back button while preserving the established web styling patterns.
- Fix the desktop recipe hero presentation so the gallery/media container keeps rounded bottom corners consistently.
- Record the current failing `apps/web` unit-test baseline and include a dedicated stabilization workstream for the pre-existing failing suites before or alongside the share UI rollout.

## Capabilities

### New Capabilities

- `web-recipe-share-management`: Web recipe, user-settings, and admin-settings surfaces for managing public recipe share links.
- `web-public-shared-recipe-page`: Anonymous readonly web rendering for shared recipes using reusable recipe detail components instead of a monolithic page.

### Modified Capabilities

- `public-recipe-sharing`: Extend the share lifecycle requirements to cover reactivation of revoked links and admin-visible instance-wide management metadata needed by the new web surfaces.

## Impact

- Affected code: `apps/web/app/(app)/recipes/[id]`, `apps/web/app/share/[token]`, any new share-specific layout/providers needed outside `(app)`, `apps/web/app/(app)/settings/user`, `apps/web/app/(app)/settings/admin`, shared recipe/share UI components, i18n messages, and related `apps/web` tests.
- Affected APIs: existing recipe-share query and mutation hooks/context consumers in web; no new backend capability is expected beyond any small contract additions required for admin/user management displays.
- Dependencies/systems: `@norish/shared-react` recipe share hooks and recipe detail context, HeroUI card/table/modal/panel patterns, `next-intl` translations, and the current web Vitest baseline (`pnpm --filter @norish/web run test:run`).
