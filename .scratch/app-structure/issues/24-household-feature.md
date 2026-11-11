# 24: `features/household`

**What to build:** The household tab's context only passed two reader hooks through. Its cards read `@norish/shared-react/reader` directly, the context and its factory go, and the tab moves into `apps/web/features/household`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 23

**Status:** ready-for-agent

- [ ] The household cards read `useHousehold`, `useHouseholdMutations` and the reader's id from `@norish/shared-react/reader`. `createHouseholdSettingsContext`, `shared-react/src/contexts/households/` and `settings/household/context.tsx` go.
- [ ] `features/household` holds the household screen: the no-household view, the household view and its cards. `settings/household/page.tsx` renders the screen and keeps its seed. One screen, so no `index.ts`.
- [ ] The screen mounts no subscription: the household is the Reader's, which the shell keeps current.
- [ ] Unit tests of the moved code live in `features/household/__tests__/`. The household E2E from 23 passes.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
