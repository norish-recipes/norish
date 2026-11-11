# 23: Settings routes

**What to build:** Each settings tab becomes a route of its own under one layout: `/settings/account`, `/settings/household`, `/settings/caldav`, `/settings/ingredients` and `/settings/admin`. What several tabs draw moves to `components/settings/`. Each tab still renders its content from where it lives today; 24–28 move each into its feature. Visible: the addresses, and the "User" tab is called "Account". See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** None (calendar has landed)

**Status:** ready-for-agent

- [ ] First, before anything moves, two E2E specs pass against today's code, each checked with `--repeat-each`:
  - household, two browsers: creating a household shows its join code; a second reader joins with the code and both see each other in the members card; the admin removes the member; a member who leaves sees the no-household view.
  - account: an API key is created, listed and deleted; a site token is added and removed; allergies are set and still set after a reload; an Avatar is uploaded and removed.
- [ ] `app/(app)/settings/{account,household,caldav,ingredients,admin}/page.tsx` exist; the user tab's folder becomes `account/`. Each page seeds what its tab draws (today's `switch` in `settings/page.tsx`, split by tab) and renders that tab's content.
- [ ] `settings/layout.tsx` draws the title and the tab bar as links, the current tab taken from the pathname. It reads only whether the reader is an admin. The navbar's settings tab stays current on every settings route.
- [ ] Each tab's `loading.tsx` draws its skeleton below the layout's tab bar, reading only the shape it needs (the household's for household, CalDAV's for CalDAV). `settings-page-content.tsx`, its `next/dynamic` imports and `SettingsShapeContext` go. `readSettingsShape` reads only what its callers draw.
- [ ] `/settings` redirects to `/settings/account` and ignores `?tab=`. The admin route's layout redirects a non-admin to `/settings/account`, so they never see its skeleton. The ingredient deep link is `/settings/ingredients?ingredient=<id>`.
- [ ] Every link to a tab names its route: the navbar (`SETTINGS_HREF`), the avatar menu, the AI-key prompt (`/settings/admin`), `scripts/measure-page-loads.ts` and every E2E spec that opens settings.
- [ ] The tab's label is "Account" in every locale (`settings.tabs.user` becomes `settings.tabs.account`).
- [ ] `components/settings/` holds what several tabs draw: the tab bar, `SettingsCard` and `SettingsAccordion`, `SettingRow` and `SwitchRow`, `SettingsSwitch`, `NewFeatureChip`, `settings-tab.ts`, the skeleton pieces the tabs share, `archive-export-button` and `share-links-table-card` (from `components/recipes/`). Nothing in the shared folders imports from `app/(app)/settings`.
- [ ] `settings-page.test.tsx` becomes a test of the layout's tab bar (Admin only for an admin) and the two redirects.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
