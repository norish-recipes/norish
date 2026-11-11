# 23: Settings routes

**What to build:** Each settings tab becomes a route of its own under one layout: `/settings/account`, `/settings/household`, `/settings/caldav`, `/settings/ingredients` and `/settings/admin`. What several tabs draw moves to `components/settings/`. Each tab still renders its content from where it lives today; 24–28 move each into its feature. Visible: the addresses, and the "User" tab is called "Account". See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** None (calendar has landed)

**Status:** ready-for-agent

- [x] First, before anything moves, two E2E specs pass against today's code, each checked with `--repeat-each`:
  - household, two browsers: creating a household shows its join code; a second reader joins with the code and both see each other in the members card; the admin removes the member; a member who leaves sees the no-household view.
  - account: an API key is created, listed and deleted; a site token is added and removed; allergies are set and still set after a reload; an Avatar is uploaded and removed.
- [x] `app/(app)/settings/{account,household,caldav,ingredients,admin}/page.tsx` exist; the user tab's folder becomes `account/`. Each page seeds what its tab draws (today's `switch` in `settings/page.tsx`, split by tab) and renders that tab's content.
- [x] `settings/layout.tsx` draws the title and the tab bar as links, the current tab taken from the pathname. It reads only whether the reader is an admin. The navbar's settings tab stays current on every settings route.
- [x] Each tab's `loading.tsx` draws its skeleton below the layout's tab bar, reading only the shape it needs (the household's for household, CalDAV's for CalDAV). `settings-page-content.tsx`, its `next/dynamic` imports and `SettingsShapeContext` go. `readSettingsShape` reads only what its callers draw.
- [x] `/settings` redirects to `/settings/account` and ignores `?tab=`. The admin route's layout redirects a non-admin to `/settings/account`, so they never see its skeleton. The ingredient deep link is `/settings/ingredients?ingredient=<id>`.
- [x] Every link to a tab names its route: the navbar (`SETTINGS_HREF`), the avatar menu, the AI-key prompt (`/settings/admin`), `scripts/measure-page-loads.ts` and every E2E spec that opens settings.
- [x] The tab's label is "Account" in every locale (`settings.tabs.user` becomes `settings.tabs.account`).
- [x] `components/settings/` holds what several tabs draw: the tab bar, `SettingsCard` and `SettingsAccordion`, `SettingRow` and `SwitchRow`, `SettingsSwitch`, `NewFeatureChip`, `settings-tab.ts`, the skeleton pieces the tabs share, `archive-export-button` and `share-links-table-card` (from `components/recipes/`). Nothing in the shared folders imports from `app/(app)/settings`.
- [x] `settings-page.test.tsx` becomes a test of the layout's tab bar (Admin only for an admin) and the two redirects.
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Implementation (904c29b16, then the i18n and route commits): the tab bar is HeroUI `Tabs` whose tabs carry `href`, under a react-aria `RouterProvider` scoped to the bar (`router.push`, `addBasePath`), since the app wires none; `aria-selected` comes from `usePathname`.
- `readSettingsShape` split into `readHouseholdShape` and `readCaldavShape`; the household and CalDAV pages pass the shape to their content, so a client tab switch's in-tab wait draws the same skeleton as `loading.tsx`. Each tab's card list sits in its tab folder (`<tab>-skeleton.tsx`) over the shared `SettingsCardsSkeleton`.
- `navTabPosition` now matches a path's first segment, so the navbar's Settings tab stays current on every `/settings/<tab>`. Each locale's "Account" reuses its existing `siteAuthTokens.account` word.
- `root-messages.test.ts` exempts all of `components/settings/` (only settings routes draw it). Every E2E `"/settings"` visit now names `/settings/account`. The E2E specs use throwaway users and delete them afterwards.
