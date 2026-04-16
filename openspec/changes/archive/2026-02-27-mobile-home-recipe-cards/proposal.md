## Why

The mobile app needs a usable, content-first home experience that helps users quickly browse their recipes at a glance. We need this now to align the mobile dashboard with core recipe discovery workflows already present in the web app while preserving a native-first feel.

## What Changes

- Add a mobile home screen recipe list rendered as modern native-style cards.
- Show recipe metadata on each card: image, title, description (clamped to two lines), servings, star rating (1-5), tags, course, liked state (heart icon), and total duration.
- Introduce temporary mock recipe data for initial delivery until backend-powered data wiring is added.
- Reuse web dashboard structure and information hierarchy patterns where appropriate while adapting spacing, interaction, and composition for mobile conventions.

## Capabilities

### New Capabilities

- `mobile-home-recipe-cards`: Mobile home feed that presents user recipes as interactive cards with complete summary metadata.

### Modified Capabilities

- `mobile-ui`: Expand mobile UI requirements to cover home-screen recipe card presentation, metadata visibility, and native interaction expectations.

## Impact

- Affected code: mobile app home/start screen components, shared recipe card presentation primitives (if introduced), and mock data source modules.
- APIs/data: no backend API changes in this phase; uses in-app mock recipe data.
- Dependencies: existing mobile UI stack and iconography/components already used in app shell.
- UX: improves recipe discoverability and consistency between web and mobile product surfaces.
