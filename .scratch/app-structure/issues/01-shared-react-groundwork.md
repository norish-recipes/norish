# 01: shared-react groundwork

**What to build:** shared-react gets the cross-cutting layer every feature will stand on. `trpc/` creates the tRPC context once for `AppRouter` and `createTRPCProviderBundle` provides that context, so `useTRPC` is a plain import; the existing factories keep working by being handed that same `useTRPC`, so nothing else changes yet. `platform/` holds one adapter provider (toasts, navigation, error display, storage) that web and mobile each mount once. The config hooks move into `config/` as plain hooks. `reader/` starts with Device Preferences: web's `DevicePreferencesContext` becomes a plain hook that selects one preference from the profile query, with Device Kind from the platform adapter. Lint stops shared-react features importing each other and stops cross-cutting folders importing features. See `.scratch/app-structure/spec.md`, "shared-react".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `@norish/shared-react/trpc` exports `useTRPC`, `useTRPCClient`, `useConnectionStatus` and the provider bundle factory; the context is created once at module level.
- [ ] Web and mobile import `useTRPC` from it; every existing `create*Hooks({ useTRPC })` call still compiles and runs.
- [ ] `@norish/shared-react/platform` exports the adapter type, its provider and a hook to read it; web and mobile each mount it once with their implementations.
- [ ] `@norish/shared-react/config` exports the config hooks (units, tags, categories, cuisines, recurrence, upload limits, locale, timers) as plain hooks; the config factory and both apps' binding files are deleted.
- [ ] `@norish/shared-react/reader` exports `useDevicePreference(key)` and its setter. A component reading one preference doesn't re-render when another changes, and a set shows at once (optimistic) and rolls back on failure.
- [ ] Device Kind comes from the platform adapter: web passes the request's kind as it does today, mobile passes its own.
- [ ] `apps/web/context/device-preferences-context.tsx` and its provider are deleted and every `useDevicePreference` / `useDeviceKind` caller reads from `reader`; the first frame still draws with the preferences applied, skeletons included.
- [ ] ESLint in shared-react blocks one feature folder importing another and a cross-cutting folder (`trpc`, `platform`, `offline`, `config`, `reader`) importing a feature.
- [ ] Gates are green, mobile included.
