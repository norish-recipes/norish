# 10: The Reader as plain hooks

**What to build:** The signed-in **Reader** (identity, household, active allergies, permissions) joins Device Preferences in `@norish/shared-react/reader` as plain hooks, so any feature reads who is reading without each app re-providing a context. Each app hands the Reader its session and sign-out through the platform adapter: web its better-auth session with the server's seed, mobile its auth context, which stays because it owns the client. The user, household and permissions contexts go, with their factories and both apps' bindings, and the shell mounts the household's and the permissions' subscriptions once. Nothing visible changes. See `.scratch/app-structure/spec.md`, "shared-react" (the Reader line) and "State".

**Blocked by:** None (groceries has landed)

**Status:** ready-for-agent

- [ ] `reader/` exports, as plain hooks importing `useTRPC` and the platform adapter: identity (the Reader, whether it is still loading, sign-out); the household with its mutations, cache helpers and subscription; the active allergies; and permissions with `select`, so a reader of one permission doesn't render for another, beside the `selectCan*Recipe` selectors.
- [ ] The platform adapter carries the session and sign-out on both apps. Web's sign-out still clears the offline engine only once the auth sign-out succeeds, then leaves for the login page; mobile's still goes through its auth context. Web's server seed still answers until the session first does, so the first paint names the Reader.
- [ ] The household subscription and the permissions' policy subscription mount once in each app's shell, on web in `ShellSubscriptions`.
- [ ] `createUserContext`, `createHouseholdContext`, `createPermissionsContext`, `createUseActiveAllergies` and the user, household and permissions hook factories are deleted, with web's user, household and permissions contexts and bindings, mobile's user context, and the unused `useServerSettingsQuery`. Every reader imports the plain hooks.
- [ ] Settings' household and user settings contexts, which go with settings, are fed the plain hooks, and the cookbook hook factory takes the Reader's id from `reader/`.
- [ ] Mobile's smoke screen shows the signed-in Reader's name through the identity hook, and its locale sync reads the same hook.
- [ ] Web's household, user and user-context tests and shared-react's Reader hydration and permissions suites move into shared-react's `src/reader/__tests__/` and run against the plain hooks.
- [ ] Lint still stops `reader/` importing a domain.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
