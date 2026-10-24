# 01 — Equipment Catalogue and Recipe Integration

Status: ready-for-human
Blocked by: none

Spec: `.scratch/recipe-equipment/spec.md`

## What was built

1. **Database Schema & Migrations**:
   - `equipment`, `equipment_aliases`, and `recipe_equipment` tables defined with Drizzle and PostgreSQL migration `0082_equipment.sql`.
   - Repositories for equipment catalogue and recipe equipment linking with fold-based matching and preparation note stripping.
   - Database seeding for 22 default equipment items with comprehensive aliases.

2. **Server & tRPC Layer**:
   - Shipped equipment icon set mechanism (`manifest.json` and 22 transparent WebP icons).
   - Dynamic `/equipment-icons/[file]` route for serving user-uploaded and shipped icons.
   - Equipment tRPC router (`equipment.list`, `equipment.get`, `equipment.create`, `equipment.saveDraft`, `equipment.remove`, `equipment.merge`, `equipment.uploadIcon`, `equipment.deleteIcon`).
   - Recipe tRPC router updated to support equipment on recipe create, update, detail, and public share queries.

3. **Web UI**:
   - Equipment input in recipe editor with draft state preservation and autocomplete.
   - Read-only static equipment list on recipe detail and shared recipe pages.
   - Equipment settings tab (`/settings/equipment`) with search, detail panel, alias management, icon upload, and merge modal.

4. **i18n & Documentation**:
   - Complete translations across all 16 supported languages in `packages/i18n`.
   - Documentation added in `apps/docs/docs/recipes/` and release notes in `apps/docs/docs/release-notes/0.26.0-beta.md`.
   - Published OpenAPI spec snapshot updated.

## Acceptance criteria

- [x] Full equipment catalogue CRUD and merge with permission checks and conflict handling.
- [x] Recipe editor supports equipment entry with dirty state tracking.
- [x] Readonly equipment list renders with icons on recipe page and shared recipe view.
- [x] `DEFAULT_EQUIPMENT` has 22 core tools with icons and multilingual aliases with zero fold collisions.
- [x] Unit test suites pass for DB defaults, shared-server catalogue, tRPC router, and frontend components.
- [x] Quality gates pass (`i18n:check`, `typecheck`, `lint`, `format:check`).

