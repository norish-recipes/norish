# 07: Each household has its own catalogue on the shared seed

**What to build:** A household's catalogue is the seed plus its own foods, spellings and junk marks. Resolution, merges and AI never cross households. Any member edits the household's foods, and the seed is the admins' alone. The export covers the seed plus your household's foods, and a food added by hand is never swept. See the spec, "Ingredient catalogue", and ADR-0042.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] **Columns:** `ingredients`, `ingredient_aliases` and `ingredient_junk_pile` get `household_id` (null means the seed).
  - A spelling's fold and an Ingredient's name are unique within a household and among the seed.
  - Where a household's spelling and the seed's are the same, the household's wins for that household.
  - The seed refresh (`packages/db/src/repositories/ingredient-seed.ts`) finds an entry by id, else by the seeded Ingredient holding its name, and never adopts or changes a household's food.
  - `ownerId` stays as "added by".
- [ ] **Migration** splits every non-seed Ingredient used by more than one household into a copy per household. The minting household keeps the original id. A copy carries:
  - the spellings that household's rows use;
  - the icon;
  - a parent in the same household or the seed;
  - the AI Changes on it.

  Aisle Links, Product Links and store preferences follow the copy belonging to their store's household. Ownerless non-seed foods go to the server owner's household (spec, "Upgrade").

- [ ] **The resolver** (`packages/shared-server/src/ingredients/resolver.ts`) reads only the household's spellings and the seed's, and mints into the household that triggered it.
- [ ] **Rights** (`mayEditOwnedRow` and its callers in `packages/shared-server/src/ingredients/catalogue.ts`):
  - any member of the household may act;
  - the seed is admin-only;
  - a merge needs edit on both foods;
  - an alias added to a seed food is the household's;
  - the ingredient policy is gone.
- [ ] **AI per household:** the automatic review, Catalogue Cleanup and Fill Gaps (`packages/trpc/src/routers/admin/ingredient-catalogue.ts`, queue workers) run per household plus the seed. An admin-started run loops over households. AI Changes and flags are listed to the owning household.
- [ ] **Export** (`apps/web/app/(app)/export/ingredients/route.ts`): the seed plus the reader's household's foods.
- [ ] **Adding by hand:** an `ingredients.add` procedure (a name plus optional spellings) marks the food as added by hand. The unused sweep and AI never delete it. Minted foods keep the 90-day rule.
- [ ] **Realtime:** catalogue events go on the household channel.
- [ ] **Tests:**
  - resolution never crosses households: B's "kipfilet XL" mints B's own food even though A has one;
  - a household spelling on a seed food changes only that household's resolution;
  - a cross-household merge is refused;
  - a migration test for the split;
  - E2E with two households on the Ingredients page.
