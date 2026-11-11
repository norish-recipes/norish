# 25: `features/account`

**What to build:** The account tab's reads and writes become plain hooks: the Account in `shared-react/reader`, the auth providers in `shared-react/config`, the Recipe Archive's import in `shared-react/recipes` with a zustand store. The user settings context and its factory go, so shared-react has no contexts left, and the tab moves into `apps/web/features/account`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 24 (the `./contexts` export goes once households has left it)

**Status:** ready-for-agent

- [ ] `shared-react/reader` holds the Account as plain hooks: the profile (`user.get`), allergies, sign-in methods (`user.signInMethods`) and site tokens (`siteAuthTokens.list`), and the writes to the name, the Avatar (upload and delete), allergies, preferences, API keys (create, delete, toggle), site tokens (create, remove) and deleting the Account. Each write's optimistic change, rollback and settle sit in `useMutation`'s own options: the preference write's today in `.then/.catch`, the site tokens' hand-written `setQueryData`. Deleting the Account leaves for sign-in through the platform adapter.
- [ ] Web's `hooks/user/use-user-{query,mutations,cache}.ts` and the unimported `hooks/user/index.ts` go. Recipes' `useSystemConversion`, `use-locale` and `use-language-switch` read the reader hooks.
- [ ] `shared-react/config` holds `useAuthProvidersQuery`. Mobile's `features/auth/hooks/use-auth-providers-query.ts` goes and its readers use the shared hook, as does the sign-in methods card. The better-auth client calls (link, unlink, change password) stay as they are.
- [ ] The Recipe Archive's import is plain hooks in `shared-react/recipes`: start an import, its progress subscription and its outcome subscription. Its progress and outcome live in a global zustand store, replacing the `["archive-import"]` query and its cache helpers. The start's success and error handling sit in `useMutation`'s own options. The shell mounts the outcome and the account screen the progress, as before. `createArchiveHooks` and web's `hooks/archive/` go.
- [ ] `createUserSettingsContext`, `shared-react/src/contexts/` and the tab's `context.tsx` go, with the context's unread fields (`isLoading`, `isUpdatingName`, `isUploadingAvatar`, `isDeletingAccount`). The `./contexts` export goes and `contexts` leaves the lint rule's `legacy` list.
- [ ] `features/account` holds the account screen and its cards, the change-password modal, and `archive-importer` (from `components/navbar/`). `settings/account/page.tsx` renders the screen and keeps its seed. `provider-icon` moves from `app/(auth)/login/components/` to `components/auth/`, and login imports it from there.
- [ ] Tests: web's user hook tests move to `shared-react/src/reader/__tests__/` and run against the plain hooks; the archive store gets a unit test (progress, then the outcome, then a new import starting fresh); `archive-import-events.test.tsx` runs against the plain hooks; `preferences-card` and `profile-card` mock the plain hooks; the feature's tests live in `features/account/__tests__/`. The account E2E from 23, `recipe-archive`, `sign-in-methods`, `device-preferences`, `first-paint` and `base-path` pass.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
