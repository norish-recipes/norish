# Households are the permission boundary

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-11-24.

- **Vocabulary:** CONTEXT.md's new "Households & Permissions" section (**Household**, **Owner**, **Permission Policy**), plus the revised **Tag**, **Cuisine**, **Category**, **Ingredient**, **Ingredient Alias** and **Flagged Ingredient**.
- **Decisions:** ADR-0041 (the household boundary), ADR-0042 (household catalogues on a shared seed) and ADR-0043 (household lists).
- **Target Version:** 0.28.0-beta.
- **Tickets:** in `issues/`. Mobile is in scope throughout; admin settings stay web-only.

## Problem Statement

Norish's permissions assume one trusting family per server. They leak as soon as a server's households don't know each other, which is the case on every public instance and the whole case for a hosted one.

- **Deleted accounts.** A deleted account's recipes and cookbooks become Orphaned. Every account on the server may then see, edit and delete them, under every policy.
- **The admin bypass.** A server admin passes every check, reads included. Their Library and tag list hold every household's recipes and tags.
- **One spelling is one food for the whole server.** A spelling household A adds (even to a seeded food), a food A's groceries mint, and a junk mark A makes all decide what household B's text resolves to. A's foods, icons and AI Changes also show on B's Ingredients page and in the export.
- **Ownerless lists.** Tags, Categories and Cuisines are shared rows with no owner. Under the default policy every household is offered every Tag on the server, and nobody can rename or delete one. Cuisines can only be edited in Admin › AI.
- **Household is derived, not stored.** It is worked out from current membership. A member's stores, groceries, pantry and plan entries therefore leave the household with them, arrive in their next one, and are deleted with their account.
- **Allergies point at tag rows.**
- **Mobile.** Mobile can manage none of this.

## Solution

Every account is in exactly one household, and the household is the boundary.

- **One Permission Policy** decides who outside a household may view, edit and delete its recipes and cookbooks: Everyone or Household for each action. The server admin is an ordinary member under it.
- **Everything else is the household's alone.** That covers its Tags, Cuisines and Categories, and its own foods, spellings and junk marks on top of the shared seed. None of it is offered, matched or changed outside the household, whatever the policy.
- **Recipes and cookbooks belong to their Owner.** They leave with the Owner and are erased with the Owner's account.
- **A Content page** (Settings, on web and mobile) lets every member manage Tags, Cuisines, Categories and Ingredients.

## Decisions

### Households

- **One household per account.** Every account belongs to exactly one household.
  - Sign-up creates a household of one, with the person as its admin.
  - Leaving a household, or being removed from it, puts the person in a new household of one.
  - Joining from a household of one merges it into the joined household (see Membership changes).
- **The household admin** keeps today's rights: removing members, the join code, and handing on the admin role. It gains no content rights.
- **Code reads the household by id.**
  - The `householdUserIds` lists and every "no household" branch go (`packages/trpc/src/middleware.ts`, `packages/shared/src/lib/household.ts`, `assertHouseholdAccess` in `packages/auth/src/permissions.ts`).
  - The realtime household channel is keyed by household id (`packages/shared-server/src/realtime/domain.ts`).
  - A membership change is still a Scope Change (ADR-0033).

### What belongs to whom

| Belongs to           | What                                                                                                                                                                                                                                                             | On leaving           | On account deletion                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------- |
| The Owner (a member) | recipes, with their images, videos and share links; cookbooks                                                                                                                                                                                                    | moves with the Owner | erased                                  |
| The household        | stores (aisles, Store Products, Product Links), groceries, recurring groceries, Pantry Ingredients, meal plan, nutrition corrections, store preferences, its own Ingredients, spellings, junk marks, AI Changes and flags, and its Tags, Cuisines and Categories | stays                | stays; "added by" reads a former member |
| The account          | ratings, favourites, allergies, preferences, language, API keys, CalDAV, Site Accounts, Recent Searches, and the share links it made                                                                                                                             | follows the person   | erased                                  |
| The instance (admin) | seeded Ingredients and spellings, the administrator's Cuisines, the built-in Categories (fixed, admins included), Ingredient Words, units, Prompts, AI and page-renderer settings                                                                                | n/a                  | n/a                                     |

- **Columns.** Household rows carry `household_id`. Instance rows have `household_id` null. Recipes and cookbooks carry `household_id` (their Owner's household) for the policy, and it moves with the Owner.
- **"Added by".** The member who added a household row is kept only as who added it, with `ON DELETE SET NULL`.

### The Permission Policy (ADR-0041)

- **Shape.** One instance-wide policy over recipes and cookbooks: view, edit and delete, each Everyone or Household. Edit and delete are never wider than view; the admin card doesn't offer it and the server refuses it.
- **Defaults and migration.**
  - The default stays view Everyone, edit Household, delete Household.
  - A stored `owner` level becomes Household.
  - The ingredient edit policy (`INGREDIENT_PERMISSION_POLICY`) is removed.
  - The policy is set in web Admin only. A hosted operator sets view to Household before opening sign-ups.
- **No admin bypass.** A server administrator is an ordinary member. `isServerAdmin` leaves these four places:
  - `canAccessResource`
  - `buildOwnerPolicyCondition` (`packages/db/src/repositories/recipes.ts`)
  - the media session check (`apps/web/lib/auth/media-session.ts`)
  - `config.tags`

  Admin rights cover the instance settings, accounts and instance entries. Server owner and admin stay one role.

- **A policy change never changes data.** Some references exist only because reading across households was allowed:
  - another household's recipe in your cookbook;
  - your favourites and ratings on it;
  - your plan entries for it.

  These are hidden while the policy doesn't let you see them, and come back if it widens. A plan entry for a recipe out of view shows only its title.

### Tags, Cuisines and Categories (ADR-0043)

- **Rows.**
  - `tags`, `cuisines` and `categories` carry `household_id`, with null meaning an instance entry.
  - Each is unique on `foldName(name)` (`packages/shared/src/lib/fold-name.ts`) within a household; instance entries are unique among themselves.
  - A household's entry keeps its own name and casing. "BBQ" and "Barbecue" may coexist.
- **What a recipe carries.**
  - A recipe carries only its own household's entries and instance entries.
  - Editing another household's recipe (edit Everyone) offers that recipe's household's list and creates any new entry there.
- **Lists and filtering.** A household's list is its own entries plus the instance's, whatever the policy. Filtering across households (at view Everyone) matches on the folded name.
- **Creating entries.** Entries are created by:
  - Add on the Content page;
  - an explicit "Create 'x'" row in the recipe picker, with existing entries shown first as you type;
  - AI under the permissive strategies (Tags `freeform`, Cuisines `extend`);
  - imports.

  AI and imports match against the household's list (fold first, then the near-match in `packages/shared/src/lib/cuisine-resolver.ts`) before creating. Imports still keep an unmatched Category as a Tag, and a Norish Recipe Archive still carries its Categories over.

- **Keeping entries.**
  - An entry stays until a member deletes it. The unused-tag and unused-category sweeps (`deleteOrphanedTagsTx`, `deleteOrphanedCategoriesTx`) go.
  - Renaming onto a name the household already has merges the two.
  - Deleting takes the entry off the household's recipes, after a confirmation that shows how many.
- **Cuisines.**
  - Households may add their own.
  - Today's Cuisines become instance entries: offered to every household, edited only by admins.
  - The `extend` strategy adds to the recipe's household, never to the instance list.
- **AI tagging.** The `predefined_db` tag strategy injects the recipe household's Tags, not every Tag on the server.
- **Allergies.**
  - Allergies become plain names the account keeps; `user_allergies` stops pointing at `tags`.
  - They are matched on the folded name against any recipe's Tags.
  - Allergy detection still asks about the household's configured allergies, and writes its Tags into the recipe's household list.

### Ingredient catalogue (ADR-0042)

- **Rows.**
  - `ingredients`, `ingredient_aliases` and `ingredient_junk_pile` carry `household_id`, with null meaning the seed.
  - A spelling's fold, and an Ingredient's name, are unique within a household and among the seed.
  - A household cannot add a spelling the seed already holds.
- **Resolution** (`packages/shared-server/src/ingredients/resolver.ts`):
  - It reads the household's spellings and the seed's, never another household's.
  - A new food lands in the household that created it: the recipe's household for a recipe line, the household for a grocery, a recurring grocery or a Pantry Ingredient.
- **Rights** (`mayEditOwnedRow` in `packages/shared-server/src/ingredients/catalogue.ts`):
  - Any member may do everything to the household's own foods: rename, parent, icon, keep distinct, junk, move or remove a spelling, delete.
  - A merge needs edit rights on both foods, so it never crosses households.
  - Anyone may add a spelling to a seeded food, and that spelling is their household's.
  - Seeded foods and spellings are the admins' alone.
  - Nutrition corrections stay any member's overlay, keyed by household.
- **AI.**
  - The automatic review of a new food, Catalogue Cleanup and Fill Gaps run inside one household plus the seed. They never merge, move or parent across households.
  - An admin-started run covers every household, each inside its own.
  - AI Changes and flags are seen by the household that owns the food. Changes to seed foods' spellings are seen by admins.
- **Export.** The catalogue export (`apps/web/app/(app)/export/ingredients/route.ts`) is the seed plus the reader's household's own foods.
- **The sweep.** A food a person adds by hand on the Ingredients tab is never removed, whether by the unused sweep or by AI. Minted foods keep the 90-day rule.
- **Another household's recipe.** Using it reads its lines through your own catalogue: adding it to groceries, pantry coverage, and the nutrition worked out for your household each resolve the line's text in your household.

### Membership changes

- **Leaving or being removed.** The person's recipes and cookbooks move to their new household of one.
  - Their Tags, Cuisines and Categories are matched on the folded name in the new household, and created where missing.
  - Their lines keep their foods. Each household food a line uses is copied into the new household with its name, the spellings those lines use, its icon and any seeded parent.
  - Nutrition corrections, store links and Aisle Links stay behind.
  - Everything else stays with the household.
- **Joining from a household of one.** When you are its last member, it merges into the household you join:
  - recipes, cookbooks and everything household-owned move;
  - Tags, Cuisines and Categories with the same folded name join the household's entry;
  - a spelling both catalogues hold merges your food into the household's, as ADR-0037 merges do;
  - Pantry duplicates are dropped;
  - both sets of stores are kept.

  A member of a larger household leaves first, then joins with what they took.

- **Deleting an account.** It erases the recipes and cookbooks the account owns, and everything of the account's, share links included.
  - Meal plan entries for its erased recipes become notes with the recipe's title.
  - A household whose last member is deleted is erased with everything in it.
  - Nothing is ever left without an owner.

### Upgrade

Migrations run from any earlier release, with no legacy shims.

- **Households.** Every account without a household gets a household of one.
- **Assigning `household_id`.** Recipes and cookbooks take their owner's household. Household rows take the household of the member who added them.
- **Orphans.** Orphaned recipes and cookbooks go to the server owner's household, with the server owner as their Owner. So do non-seed Ingredients and spellings whose minter is gone.
- **Splitting shared rows.** This applies to shared Tag and Category rows, and to every non-seed Ingredient used by more than one household.
  - Each household gets its own copy of what its rows use.
  - The household that minted the row keeps the original id.
  - An Ingredient's copy carries the spellings that household uses, its icon, a parent in the same household or the seed, and the AI Changes on it.
  - Store-keyed links follow the copy that belongs to their store's household.
- **Cuisines.** Today's rows become instance entries; nothing is split.
- **Allergies** become names.
- **Policy settings.** The recipe policy's `owner` becomes `household`, and the ingredient policy row is dropped.

### The Content page

- **Where it lives.** One Settings tab, **Content**, on web, replacing the Ingredients tab. On mobile, one Settings row. Both have tabs for Tags, Cuisines, Categories and Ingredients.
- **Design first.** The design comes from a canvas (ticket 10) before it is built.
- **Each tab shows:**
  - the household's entries plus the instance's;
  - search;
  - a count of the household's recipes carrying each entry (Ingredients as today);
  - an "unused" filter;
  - Add, rename (merging onto an existing name), and delete with a confirmation showing the count.
- **Instance entries.**
  - Read-only for members.
  - Admins edit them on both apps; the instance Cuisines move here from Admin › AI.
  - Built-in Categories are fixed for everyone.
- **Ingredients tab.** It keeps today's actions (spellings, parent, icon, merge, keep distinct, flags, Changed by AI, junk prompts, nutrition correction, credits, export) and gains Add. Mobile gets all of it.
- **Admin settings stay web-only.** The Permission Policy card is the only admin change.

### Out of scope

- Allergens as their own thing (an instance list checked on every recipe). That is the next spec.
- Taking copies of recipes into another household. Leaving moves them instead.
- A mobile admin area.
- Near-duplicate detection (BBQ and Barbecue).
- Per-kind policies, an Owner level, and per-item visibility.

## Testing

- **The policy matrix** at the tRPC caller level with mocked repositories, as the existing router tests do: view, edit and delete × Everyone and Household, with no admin bypass.
- **Repository tests** proving that lists and the catalogue never cross households: uniqueness per household, resolution and merges.
- **Migration tests** on a fixture with two households sharing Tags, Categories and foods, plus orphans and a household-less account.
- **E2E** with two households under both view levels, per ticket. The checks written to verify a change stay as tests.
- **A mobile device check** of the Content screen.
