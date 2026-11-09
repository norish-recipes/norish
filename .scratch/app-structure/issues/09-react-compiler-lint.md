# 09: Lint reports every React Compiler skip

**What to build:** The React Compiler leaves a component or hook uncompiled, silently, when it meets something it can't memoise safely. React reports those skips through `eslint-plugin-react-hooks` (v6 and later), which this repo never installed; instead `tooling/eslint/react.ts` grew hand-written selectors for two triggers (`finally`, logical assignment), so a compiler scan found 22 skipped functions the gates never saw (web 14, mobile 4, shared-react 4). Add the plugin to `tooling/eslint` and turn its rules on in `compiledReactConfig`, which web, mobile, shared-react and ui use and landing doesn't. Drop each hand-written selector the plugin covers. Fix every skip it reports. See `.scratch/app-structure/spec.md`, "State" (the compiler line).

**Blocked by:** None. Runs after the groceries restructure, which fixes the two skips in groceries.

**Status:** ready-for-agent

- [ ] `eslint-plugin-react-hooks` 7.x is a dev dependency of `tooling/eslint`, through the pnpm catalog, and its compiler rules and `rules-of-hooks` are on for web, mobile, shared-react and ui; landing stays off.
- [ ] The hand-written selectors for compiler triggers in `tooling/eslint/react.ts` are gone where the plugin reports the same thing, and their rule tests follow.
- [ ] Every skip the rules report is fixed in the code; none is silenced. A deliberate opt-out (`"use no memo"` for TanStack Virtual) stays explicit and passes.
- [ ] A scan with the compiler finds no skipped function in the four workspaces.
- [ ] CONTRIBUTING's compiler lines say lint reports every skip; the spec's compiler line says the same.
- [ ] Gates are green, mobile included.
