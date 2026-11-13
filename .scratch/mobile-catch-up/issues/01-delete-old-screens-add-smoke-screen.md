# 01: Delete the old tab screens and add the smoke screen

**What to build:** The app shrinks to what survives the redesign. Every tab screen goes (dashboard, recipe detail, search, groceries, calendar and profile), along with the components, hooks and mobile-only copies of shared logic that only those screens used, including the faked-glass views. The sign-in flow stays: server address, login, register, the sign-in callback and the error screen. Behind sign-in there is one plain, unstyled smoke screen that shows the signed-in user, a recipe count and one grocery list with a checkbox per item. What survives is laid out by feature, as the spec's "Folder structure" describes. This happens before the SDK upgrade so 02 never fixes types in code that is about to be deleted. See `.scratch/mobile-catch-up/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] No tab screen remains, and nothing under the app still references a deleted screen or component.
- [x] The sign-in flow screens are untouched apart from what the deletions force.
- [x] The smoke screen reads the user, the recipe count and a grocery list through the existing shared-react hooks and contexts, and checking an item off calls the existing grocery mutation.
- [x] The app's root layout routes a signed-in user to the smoke screen.
- [x] Mobile-only helpers whose only callers were deleted screens are deleted. Nothing is moved into `@norish/shared` in this ticket.
- [x] Vitest files that test deleted code are deleted with it.
- [x] The sign-in flow lives in `src/features/auth/` and the smoke screen in `src/features/smoke/`; route files under `src/app/` only render a feature's screen.
- [x] Surviving shared code sits in `src/components/`, `src/hooks/` or `src/lib/`, and the old type-based folders that end up empty are gone.
- [x] Surviving tests sit next to their code as `*.test.ts(x)`, and `__tests__/` is gone.
- [x] An ESLint `no-restricted-imports` override stops one feature importing another.
- [x] The app still type-checks in its separate install (the app is still parked here).

## Comments

- 2026-11-08 — The last box is ticked by ticket 02: the app has no separate install any more, and `pnpm --filter @norish/mobile typecheck` passes inside the workspace.
