# 04: Deleting an account erases what it owns

**What to build:** Deleting an account erases the recipes and cookbooks it owns and everything that belongs to the account, its share links included. The household keeps its own things, and meal plan entries for the erased recipes become notes with the recipe's title. A household whose last member is deleted goes with everything in it. See the spec, "Membership changes".

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] **Recipes and cookbooks** `user_id` become `ON DELETE CASCADE`, so the images, videos, step images and cookbook files of erased recipes are swept as recipe deletion already does.
- [ ] **Account rows** (ratings, favourites, allergies, API keys, CalDAV, Site Accounts, share links) keep cascading.
- [ ] **Plan entries for erased recipes:** before the cascade, `deleteUserAccount` (`packages/auth/src/account-deletion.ts`) turns the household's plan entries for the account's recipes into notes carrying the recipe's title.
- [ ] **Last member deleted:** the household row and everything with its `household_id` are erased. A member of a larger household is handed on as admin first, as today.
- [ ] **Both paths** use the same function: a person deleting their own account, and an admin removing someone.
- [ ] **Tests:**
  - the household keeps its stores and groceries, and the plan shows the note;
  - the deleted account's recipes are gone for every reader;
  - deleting the last member erases the household.
  - E2E for self-deletion.
