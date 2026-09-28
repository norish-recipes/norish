# 12: Browser spec, docs and release notes

**What to build:** Cover the feature end to end in the browser and document it. One spec in the `ai` Playwright project, seeding its own small catalogue rather than fetching:
- A Dutch "ui" in the Pantry leaves an English recipe's "onion" off the list.
- A flagged Ingredient shows on the Ingredients page.
- Merging it into the Ingredient that holds an Aisle Link files its grocery in that Aisle.

The spec follows the pantry and grocery-aisles specs, including their shared-database traps. Docs per `docs/agents/feature-docs.md`: `apps/docs` pages for the Ingredients page, the ingredient edit policy and the Data sources page, with screenshots, plus the release-notes entry for the Target Version.

**Blocked by:** 08, 09, 10, 11

**Status:** done

- [x] The new E2E spec passes alongside the existing `ai` project specs.
- [x] The docs pages and screenshots are added, and the Upgrade notes cover the migration and the env var.
- [x] The release notes are updated.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- The spec is `apps/web/__tests__/e2e/ai/ingredient-catalogue.e2e.ts` with its support module. It seeds its own catalogue and Store straight in the database and resets recipes, groceries, recurring groceries and Ingredients first, as the pantry scenario does. The E2E harness now starts the server with `INGREDIENT_CATALOGUE_URL=""`: nothing outbound, and no 5,700-Ingredient seed landing mid-run.
- Docs: a new `groceries/ingredients.md` page with three screenshots; `pantry.md`, `aisles.md` and `admin-settings.md` rewritten where they described matching by name; the env var on `configuration/server-runtime.md`. The screenshot capture spec is `.scratch/ingredient-catalogue/docs-screenshots.e2e.ts` (copy into `ai/`, run with `DOCS_SHOTS=1`, delete).
- The screenshots caught two page bugs, fixed here: the spelling toggle read "Show all 1 spellings", and a food known only in other languages (a Dutch-only flagged mint seen by an English viewer) showed no spellings at all. It now shows them all, and the toggle reads "More spellings (N)".
- Gates on 2026-09-28: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, the docs format check and docs build all pass. The full E2E run (all three projects) was 134 passed, 1 failed: `cookbooks.e2e.ts` "a cookbook fills itself from its own side" timed out, then passed 12/12 when the spec ran alone on the same build, so the failure depends on test order and does not reproduce in isolation. After the review fixes, the catalogue, pantry and grocery-aisles specs pass together (17/17).
