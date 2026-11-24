# 05: Tags, Cuisines and Categories are household lists

**What to build:** Each household has its own Tags, Cuisines and Categories, unique on the folded name, plus the instance entries: the four built-in Categories and the administrator's Cuisines. A recipe carries only its household's entries and the instance's. Entries stay until deleted, households may add Cuisines, and allergies become plain names. See the spec, "Tags, Cuisines and Categories", and ADR-0043.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] **Columns:** `tags`, `cuisines` and `categories` get `household_id` (null means an instance entry), unique on `foldName(name)` within a household and among instance entries.
- [ ] **Migration:**
  - Shared Tag and Category rows are split, giving each household a copy of what its recipes use. The household that created the row keeps the original id.
  - Built-ins and today's Cuisines become instance entries.
- [ ] **Repositories** (`packages/db/src/repositories/tags.ts`, `categories.ts`, `cuisines.ts`):
  - find-or-create works inside the recipe's household;
  - attaching refuses an entry from another household;
  - `deleteOrphanedTagsTx` and `deleteOrphanedCategoriesTx` go;
  - rename-onto-existing merges (revive `updateTagName` for all three);
  - delete detaches from the household's recipes.
- [ ] **New procedures** for list, add, rename, merge and delete, for every member of the household. Instance entries are admin-only; built-in Categories refuse every change. These replace `admin.cuisines.*` (`packages/trpc/src/routers/admin/cuisines.ts`).
- [ ] **Lists** (`packages/trpc/src/routers/config/procedures.ts`): `config.tags`, `config.categories` and `config.cuisines` return the household's entries plus the instance's, whatever the policy. Library filters at view Everyone match on the folded name across households.
- [ ] **AI and imports:**
  - the `predefined_db` tag strategy injects the recipe household's Tags;
  - the `freeform` tag and `extend` cuisine strategies (`packages/shared-server/src/ai/enrichment/provenance-inferrer.ts`) match the household's list (fold, then `cuisine-resolver`'s near-match) before creating, and create in the recipe's household;
  - imports match the same way, and `category-matcher` keeps unmatched Categories as Tags.
- [ ] **Allergies:**
  - `user_allergies` stores a name instead of a `tag_id`;
  - warnings match on the folded name against any recipe's Tags;
  - allergy detection writes into the recipe's household list.
- [ ] **Realtime:** list changes publish on the household channel.
- [ ] **Tests:**
  - repository tests for uniqueness per household and the refused foreign attach;
  - a migration test on two households sharing "soja";
  - E2E: household A's Tags are never offered to household B under view Everyone, but B sees them on A's recipes and can filter by one.
