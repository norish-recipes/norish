# 01: shared-react groundwork

**What to build:** shared-react gets the cross-cutting layer every feature will stand on. `trpc/` creates the tRPC context once for `AppRouter` and `createTRPCProviderBundle` provides that context, so `useTRPC` is a plain import; the existing factories keep working by being handed that same `useTRPC`, so nothing else changes yet. `platform/` holds one adapter provider (toasts, navigation, error display, storage) that web and mobile each mount once. The config hooks move into `config/` as plain hooks, with the ingredient catalogue's subscription. `reader/` starts with Device Preferences: they get their own seeded `user.getDevicePreferences` query, and web's `DevicePreferencesContext` becomes a plain hook that selects one preference from it, with Device Kind from the platform adapter. Lint stops shared-react features importing each other and stops cross-cutting folders importing features. See `.scratch/app-structure/spec.md`, "shared-react".

**Blocked by:** None (`feat/mobile-catch-up` merged into the rc as 4589f4f95)

**Status:** ready-for-agent

Part A done at 1256ea977, part B open.

- [x] `@norish/shared-react/trpc` exports `useTRPC`, `useTRPCClient`, `useConnectionStatus` and the provider bundle factory; the context is created once at module level.
- [x] Web and mobile import `useTRPC` from it; every existing `create*Hooks({ useTRPC })` call still compiles and runs.
- [x] `@norish/shared-react/platform` exports the adapter type, its provider and a hook to read it; web and mobile each mount it once with their implementations.
- [ ] `@norish/shared-react/config` exports the config hooks (units, tags, categories, cuisines, recurrence, upload limits, locale, timers) as plain hooks; the config factory and both apps' binding files are deleted.
- [ ] The ingredient catalogue's subscription is a plain hook in `config/` that the shell mounts; the ingredients factory and `context/ingredients-realtime.tsx` are deleted.
- [ ] A `user.getDevicePreferences` query returns the reader's preferences and the signed-in layout seeds it next to `user.getAllergies`. `readDevicePreferencesSeed`, the shell's separate `devicePreferences` seed and the `preferences` field on `user.get` are deleted.
- [ ] `@norish/shared-react/reader` exports `useDevicePreference(key)` and its setter. A component reading one preference doesn't re-render when another changes, and a set shows at once (optimistic) and rolls back on failure.
- [ ] What the context guaranteed still holds, now through hydration's newer-wins rule and the mutation's scope: a fresh server read beats an older restored copy while Live; a newer local copy wins while Offline, including a document the worker saved before the last change; writes go one at a time, through the Outbox while Offline; signed out or on a shared recipe a change stays for the visit and is never written. The cases in `device-preferences-context.test.tsx` carry over to the hook's test, and the `first-paint` and `offline` E2E specs pass.
- [ ] Device Kind comes from the platform adapter: web passes the request's kind as it does today, mobile passes its own.
- [ ] `apps/web/context/device-preferences-context.tsx` and its provider are deleted and every `useDevicePreference` / `useDeviceKind` caller reads from `reader`; the first frame still draws with the preferences applied, skeletons included.
- [x] `providers/` becomes `trpc/`, and `offline/`'s imports of `ConnectionStatus` and `trpc-links` follow it.
- [ ] `hooks/optimistic-updates.ts` moves to `offline/`, and every mutation hook that imports it (groceries, stores, pantry, calendar, cookbooks, recipes, ratings, recipe detail) imports it from there; the `useDevicePreference` setter uses it too.
- [x] `filter-contract.ts` and `list-queries.ts` move to `@norish/shared/contracts`; the `./filter-contract` and `./list-queries` exports are deleted and their importers (`offline/warm-set`, web's server seeding and the rest) import from `@norish/shared`.
- [x] ESLint in shared-react blocks one feature folder importing another and a cross-cutting folder (`trpc`, `platform`, `offline`, `config`, `reader`) importing a feature.
- [ ] Gates are green, mobile included.
