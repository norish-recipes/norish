# 10: The React Compiler, app-wide

**What to build:**

- Screens re-render only when something on them changed, without anyone hand-placing memo hooks.
- Contributors get @eslint-react's versions of the compiler's lint rules, so code that breaks the compiler's assumptions is flagged when written.

See `.scratch/architecture-after-upgrades/spec.md`, React Compiler.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged.

**Status:** ready-for-agent

- [x] Before turning it on, record here the render counts on two heavy screens (for example the groceries screen and the recipe page) with React's profiler.
- [x] `reactCompiler` is on app-wide in infer mode. The experimental Rust compiler is not used.
- [x] The compiler lint rules switched off today are switched back on, and what they flag is fixed. After the sweep's ticket 39 those are @eslint-react's `refs`, `immutability` and `set-state-in-effect`. `incompatible-library` and `preserve-manual-memoization` exist only in eslint-plugin-react-hooks, which the sweep removed and which stays removed (maintainer, 2026-10-14); go without them.
- [x] Existing `useMemo`/`useCallback` stay, and the contributing guide says new code doesn't add them.
- [x] Hook aliases keep a `use` prefix. A lint rule or a comment at each shared hook bag guards it.
- [x] Record here the render counts on the same two screens, after.
- [x] The full E2E suite passes against a fresh `pnpm build`, with no new flake (`--repeat-each` on any spec that turns red once).

## Comments

- 2026-10-14. **Render counts before the compiler.** Production build, desktop viewport, reduced motion, counted through React's DevTools hook the way the profiler counts: a component counts when it mounts or does work in a commit, and a subtree React bailed out of is skipped. Script: load the screen, wait a second, then
  - groceries: add two items through the Add Item panel, then tick both off. 14,962 / 13,996 / 14,558 renders over three rounds (about 122 to 125 commits).
  - recipe page: press the servings increase three times, then scroll 1,200 px. 11,126 renders, 43 commits, the same in every round.
- 2026-10-14. **Render counts after**, same build type and script (production, desktop, reduced motion, from clean data):

  |                          | Before the compiler      | Compiler on, before the fixes below | After                 |
  | ------------------------ | ------------------------ | ----------------------------------- | --------------------- |
  | Groceries (three rounds) | 14,962 / 13,996 / 14,558 | 7,604 / 7,956 / 7,546               | 5,472 / 5,019 / 5,358 |
  | Recipe page              | 11,126                   | 4,519                               | 2,949                 |

  Per action, on a dev build with component names: ticking one grocery off went from about 1,400 re-renders (every row, four times) to about 110, and one servings press from 503 to 173.

  Split into mounts and re-renders: groceries is 988 mounts and 4,370 re-renders, the recipe page 1,423 and 1,526. What is left is change on screen: adding a line moves every open line of its Store down one place, so that Store's rows re-render for the optimistic write, the server's answer and the realtime event (about 330 each); the panel's drawer re-renders through its open and close animation; a servings press re-renders the 22 lines and 20 steps whose numbers changed (both layouts are mounted).

- **What turning the compiler on took, beyond the config:**
  - **shared-react was invisible to it.** Infer mode compiles top-level components and hooks only, and shared-react builds almost all of its hooks and providers inside factories (`createUseGroceriesMutations({ useTRPC })` returns `useGroceriesMutations`): 30 functions in 168 files compiled. Every factory-built hook and component now starts with `"use memo"` (128 of them), and 132 compile. A lint rule flags one built without it.
  - **Optional hooks** called as `useX?.()` made the compiler skip the user, recipes and cookbook providers; each is now settled once per factory. **`throw` and value blocks inside `try`** made it skip the user-settings provider; its callbacks use promise `.catch()` now, which also ends a double error toast when an avatar upload or removal failed.
  - **TanStack's mutation result is a new object every render**, and the compiler keys a callback that calls `xMutation.mutate()` on that object: every action in every mutation hook was rebuilt each render, so every grocery row re-rendered on any change. The 101 calls now use the stable `mutate` destructured once.
  - **The grocery actions closed over the list** (for versions and rollback). They read it as of the last render through a ref, with the rollback snapshot taken when the action runs, as before.
  - **Rebuilt groups.** The grouped list rebuilds every group on any change; `useStructuralSharing` keeps the objects of the groups that did not change, as TanStack Query does for query data.
  - **Rows inline in a `.map()`** are new elements on every render of their list, and the compiler cannot memoise inside the loop: the recipe's ingredient lines and steps are their own components now, so their checkbox, icon and instruction text are skipped when only the amount changed.
  - **TanStack Virtual is incompatible with the compiler** (one mutable instance): the seven components that call its hooks opt out with `"use no memo"`, or the library grid and calendars render no rows.
  - **Clock reads in render** freeze under memoisation: the join-code countdown keeps the time in state.
  - **Render-time adjustments must not track a value that is new on every render**: `useLocaleConfigQuery` returned a fresh locale list each render, and the language switch looped (React error #301) on every page; it is memoised now, with a test.
- **Not compiled, by the compiler's own limits** (behaviour unchanged, just not memoised): 6 components whose manual memoisation it cannot preserve, the tRPC provider and `useRealtimeSubscription` (refs read in closures handed over during render).
- 2026-10-14. **The `try` handlers compile now.** 39 web files were skipped for a `try` with `finally` or without `catch`, or with a condition, `?.` or `throw` in the `try` block (settings forms, the auth forms, import modals, the media inputs, the ingredient panel). Their handlers chain `.then()`/`.catch()`/`.finally()` on the promise instead, as the user-settings provider already did; four whose mutation returns nothing (create and update recipe, kick and transfer admin) are plain `try`/`catch` now. A `no-restricted-syntax` rule flags a `finally` in a component or hook. The compiler scan finds no `try` skip left.
- **The lint sweep:** 215 findings of `refs`, `immutability` and `set-state-in-effect` in 67 files, fixed by deriving state, adjusting it during render, `useSyncExternalStore` for browser reads, and moving work into handlers; one justified `eslint-disable` (the auth marks' draw needs the undrawn frame committed first). Landing's three findings went the same way.
- **E2E:** 181 of 181 passed against a fresh build, no flaky test. (A first run lost the offline project to port 3100, held by another checkout's dev server; it ran on 3110 the second time.)
