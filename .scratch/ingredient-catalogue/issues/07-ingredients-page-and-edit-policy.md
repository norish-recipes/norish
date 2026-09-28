# 07: Ingredients page and edit policy

**What to build:** A user-facing **Ingredients** page under settings. It lists Ingredients with search, each showing its aliases and flag, with a flagged filter. Its actions are add alias, rename and mark distinct, and an action the viewer may not take is hidden. A new instance-wide ingredient permission policy, set by the administrator beside the recipe permission policy, has one level, `edit`: everyone, household or owner, defaulting to household. Ingredients are always visible. Rules:

- Adding an alias is open to everyone.
- Renaming follows `edit` on the Ingredient.
- Removing an alias follows `edit` on the alias.
- Ownerless (seeded) rows are editable only by administrators, and administrators bypass the policy.

Renaming or marking a flagged Ingredient distinct clears its flag.

**Blocked by:** 01

**Status:** done

- [x] The policy setting exists with its default, is editable in admin settings, and is documented.
- [x] tRPC caller tests cover the everyone/household/owner matrix, admin-only ownerless rows and the administrator bypass.
- [x] The page lists, searches and filters by flag. Add alias, rename and mark distinct work, and each clears the flag where the spec says so.
- [x] Copy is in i18n, and `pnpm i18n:check` passes.

## Comments

- The page is a fifth settings tab, **Ingredients** (`/settings?tab=ingredients`), open to every member. The policy is its own admin card, **Ingredient Permissions**, beside the recipe one; both share `permission-level-select.tsx`. Documented in `apps/docs/docs/configuration/admin-settings.md`; the page's own docs and screenshots are 12's.
- The edit rule lives in `packages/shared-server/src/ingredients/catalogue.ts` (`mayEditIngredientRow`), next to the resolver, so merges (08) and parents (09) check it the same way. `ingredients.list` answers `canEdit` per Ingredient and `canRemove` per alias, so the client needs no copy of the policy.
- Removing an alias is refused while a recipe line, grocery, recurring grocery or Pantry Ingredient points at it (moving it is 08's alias move), and an Ingredient always keeps one alias.
- Renaming does not add the new name as an alias; the old spellings stay.
- No realtime event yet: the spec's _ingredients changed_ broadcast lands with merge (08), which is where other members' lists start to go stale. A policy change is not broadcast either: the page asks the server what the viewer may do on every list read.
- A pre-catalogue Ingredient's owner is the first member who used it (migration 0055), which is what this policy now reads.
- 2026-09-28, after the feature: the row's inline accordion of edits was replaced by a Panel per Ingredient (`ingredient-panel.tsx`): a flag notice with Ask AI and Mark distinct at the top, then Name, Kind of and Spellings sections, each edit saved as it is made, and Merge into… and Delete in the footer. An edit that names another Ingredient (merge, parent, a spelling's move) opens a nested Panel with the picker (`ingredient-relocation.tsx`), whose options portal into the panel per #511. The panel follows its item through the list, so a merge or a refresh shows there and a merged-away food closes it. The bulk Ask AI button shows whenever the list holds flagged foods the viewer may edit, not only under the flagged filter.
