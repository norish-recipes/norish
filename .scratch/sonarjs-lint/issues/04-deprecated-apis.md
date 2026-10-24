# 04 — Deprecated APIs

Status: resolved
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 125 uses of deprecated APIs (54 files) move to their replacements, and `sonarjs/deprecation` leaves the temporary block.

The largest groups, as measured on 2026-10-14:

- Our own: the recipe's `image` field (33), deprecated in `packages/db-schema/src/schema/recipes.ts` because the primary image lives in `recipe_images`
- React Aria's `onSelectionChange` (14) and `selectedKey` (10)
- `UNSTABLE_portalContainer` (12)
- `KeyboardEvent.keyCode` (11)
- React's `FormEvent` (5)
- Zod 4's `z.string().url()` (5) and `z.number().finite()` (2)
- TanStack Query's `fetchQuery`/`fetchInfiniteQuery` signatures (about 15 calls)
- The AI SDK's `experimental_evaluate` and `Experimental_EvaluationModel` (5)
- `Buffer#slice` (2)
- `BeforeUnloadEvent.returnValue` (1)

Read each deprecation note in the installed package before replacing; the replacement is what it names. A deprecated API with no replacement yet in the installed version keeps a disable that says so.

## Acceptance criteria

- [x] `sonarjs/deprecation` is not in the temporary block, and `pnpm lint` passes. Whichever of 02, 03 and 04 lands last deletes the block.
- [x] Screens whose selection or portal props changed are checked in the browser, and the E2E specs that cover them pass.

## Comments

- 2026-10-14 (implemented; browser checks and E2E still open).
  - Moved to the named replacement:
    - React Aria `selectedKey`/`onSelectionChange` → `value`/`onChange` on every Select and ComboBox but one (below). Same events in React Stately, except that `onChange` stays quiet when the row already selected is picked again.
    - TanStack `fetchQuery`/`prefetchQuery` → `query`, `fetchInfiniteQuery` → `infiniteQuery`. `useRecipePrefetch`'s retry was dead (`prefetchQuery` never rejects), so it went rather than come alive.
    - AI SDK `experimental_evaluate` → `experimental_decide`, `Experimental_EvaluationModel` → `Experimental_DecisionModel`, TypeSafe's `evaluationModel` → `decisionModel` (the same model underneath).
    - Zod `z.string().url()` → `z.url()` (same results and JSON schema, checked); `.finite()` dropped, a no-op in Zod 4.
    - `keyCode` → `key` in the time fields, with a test written against the old handler first; React's `FormEvent` → `SubmitEvent`; `Buffer#slice` → `subarray`; `returnValue` dropped, `preventDefault()` already asks.
  - The recipe `image` field:
    - The dashboard and archive schemas now declare their own `image`, the resolved primary image and the hero, so reading them no longer counts as reading the column.
    - Readers go through `primaryRecipeImage`: the optimistic dashboard card (a real bug: a gallery-only recipe's card showed no picture until the list refetched; test added), the recipe form's media (its copy of `buildInitialMedia` deleted), and the enrichment coordinator's `hasAnyImage`.
    - The Instagram processor no longer sets the scalar beside the gallery image it already writes.
  - Disables, each a deliberate reader:
    - `UNSTABLE_portalContainer` (12): `UNSAFE_PortalProvider` lives in `react-aria`, which `apps/web` does not depend on, and React Aria Components only hears the provider from its own copy. `usePanelPortalContainer`'s note says so.
    - `onSelectionChange` in `grocery-product-field`: tapping the auto-picked row makes it the shopper's own, and `onChange` does not fire for that tap.
    - The legacy `image` scalar: `primaryRecipeImage` (the one fallback reader), the repository's payload alias (3) and one `legacyImageColumn` alias for its cleanup, migration and Dish Colour queries, the generated-image write that clears the scalar, the Dish Colour's "does this update touch media" check, the share view, the archive media rehome, and the optimistic full recipe.
    - `autoTaggingMode`/`autoTagAllergies` (2): the config migration that replaces them.
  - The temporary block in `tooling/eslint/base.ts` is gone with this ticket, the last of the three: `pnpm lint` passes with the whole profile on.
- 2026-10-14 (browser checks and review).
  - The full browser suite passes (181), covering the grocery, ingredient, provenance, calendar, icon, nutrition and share-panel pickers.
  - Checked by hand on a production build: General's default language, the four permission selects (each saved through `onChange` and put back), the AI, vision and image model comboboxes, and the job-queue filter all take a pick; the recipe time fields stop letters and keep copy, select-all and paste.
  - Review fix: the time fields read the clipboard shortcuts by `key` only, so on a Cyrillic layout (`key` "м" for V) copy and paste were stopped. They now also accept the physical key (`code`), with a test for it.
  - Left for the maintainer: `UNSAFE_PortalProvider` needs `react-aria` as a direct dependency of `apps/web`, kept at React Aria Components' exact version, before the 12 portal disables can go; and dropping `returnValue` loses the leave prompt on Chrome 111 to 118.
- 2026-10-15 (maintainer's calls).
  - The 12 portal disables are gone: `apps/web` depends on `react-aria` at the version React Aria Components pins (3.53.1, one copy in the lockfile), and `PanelPortal` in `Panel.tsx` wraps each popover in `UNSAFE_PortalProvider`, replacing `usePanelPortalContainer`. `slot-dropdown.test.tsx` and `icon-action-button-tooltip.test.tsx` fail when the provider goes unheard, so a `react-aria` left behind on an RAC upgrade shows up as a red test.
  - The legacy `image` scalar is gone with its column (migration 0074 copies it into the gallery where a recipe has none), and with it the `legacyImageColumn` alias and every image disable. Three deprecation disables remain: `onSelectionChange` in `grocery-product-field` and the two `autoTaggingMode`/`autoTagAllergies` reads in the config migration.
  - The last three disables are gone. `grocery-product-field` uses `onChange`, and each row answers its own tap when it is the row already picked (the one tap `onChange` cannot see), with a test for the tapped auto-pick. The AI config's pre-0.20 tagging fields and their migration are removed: every boot rewrites stored config through the schema, so only an install updating straight from 0.19 or earlier still holds them, and its two settings go back to their defaults (Upgrade note).
  - `returnValue` stays dropped: the reload prompt shows without it. Leaving the editor through a link in the app or the back button did not ask at all; the guard now holds those too (a capture-phase link click, and the Navigation API's traverse event), with `unsaved-recipe-changes.e2e.ts` covering reload, Cancel, a link and Back.
- 2026-10-15 (branch review, the maintainer's calls):
  - **The link and Back guard is dropped as scope creep.** This ticket asked only for `returnValue` to go. The guard is back to the reload prompt without it, the release-note line is gone, and `unsaved-recipe-changes.e2e.ts` covers reload and Cancel again.
  - **No browser pass for the late portal and picker changes.** `3ef31c03` (the `UNSAFE_PortalProvider` move) and `fd7bf9ed` (the product field's `onChange`) came after the recorded browser run; the maintainer accepts their unit tests without an E2E pass.
