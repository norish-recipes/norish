# 24: `features/household`

**What to build:** The household tab's context only passed two reader hooks through. Its cards read `@norish/shared-react/reader` directly, the context and its factory go, and the tab moves into `apps/web/features/household`. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 23

**Status:** ready-for-agent

- [x] The household cards read `useHousehold`, `useHouseholdMutations` and the reader's id from `@norish/shared-react/reader`. `createHouseholdSettingsContext`, `shared-react/src/contexts/households/` and `settings/household/context.tsx` go.
- [x] `features/household` holds the household screen: the no-household view, the household view and its cards. `settings/household/page.tsx` renders the screen and keeps its seed. One screen, so no `index.ts`.
- [x] The screen mounts no subscription: the household is the Reader's, which the shell keeps current.
- [x] Unit tests of the moved code live in `features/household/__tests__/`. The household E2E from 23 passes.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Implementation (7014508b4): the screen is `features/household/household-screen.tsx` (`HouseholdScreen`, from `household-settings-content.tsx`), the views, cards and `household-skeleton.tsx` sit in `features/household/components/`, and `household-shape.ts` at the feature root.
- Deviation: `readHouseholdShape` moved out of `settings/read-settings-shape.ts` into `features/household/read-household-shape.ts`, since lint lets only route files import a feature and that file needed `HouseholdShape`; `read-settings-shape.ts` keeps only CalDAV's read (26 moves it the same way).
- `root-messages.test.ts` exempts `features/household/`. The moved code had no unit tests; `__tests__/household-screen.test.tsx` covers the skeleton / household / no-household choice.
- The `./contexts` export stays for `createUserSettingsContext` until 25.
