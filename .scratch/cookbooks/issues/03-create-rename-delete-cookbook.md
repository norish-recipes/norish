# 03 — Create, rename and delete a cookbook

**What to build:** A **Cookbook** becomes a real thing. With the Cookbooks chip active the Add button offers **+ Cookbook**, which asks for a title and nothing else. Cookbooks appear as cards in the Library with a ⋯ menu holding Rename and Delete, exactly as recipe cards have one. Deleting confirms by name and never touches any recipe. Who may see, rename and delete a cookbook follows the recipe permission policy the administrator already set — there is no new setting (ADR-0027).

**Blocked by:** 02 — cookbooks are only reachable through the Cookbooks chip.

**Status:** ready-for-agent

- [ ] A cookbook stores a title, an owner, timestamps and a version, and nothing else — no cover, no description, no ordering
- [ ] Viewing, editing and deleting a cookbook obey the existing recipe permission policy, with no new administrator setting introduced
- [ ] Deleting an account detaches the cookbooks it made rather than destroying them, and an **Orphaned** cookbook is visible, editable and deletable by everyone under every view policy, exactly as an orphaned recipe is
- [ ] The Add button reads **+ Cookbook** while the Cookbooks chip is active and is unchanged under All and Recipes
- [ ] Creating asks only for a title and lands the reader on the new cookbook
- [ ] A cookbook card carries a ⋯ menu with Rename and Delete, matching the recipe card's menu
- [ ] Delete confirms by name, following the recipe delete confirmation
- [ ] Deleting a cookbook leaves every recipe it held untouched
- [ ] A cookbook with no members renders a plain tinted tile rather than looking broken
- [ ] Database seam test: each view policy filters cookbooks correctly, and an orphaned cookbook is visible under all of them
- [ ] Router seam test: rename and delete are refused without the policy's edit and delete rights
- [ ] All new strings exist in 14 locales; `pnpm i18n:check` passes
