# 28: `shared-react/admin` and `features/admin`

**What to build:** The admin factory and every admin card's inline tRPC call become plain hooks in a new `shared-react/admin`. The 405-line admin context, which only passed one query and its mutations through, goes, and the tab moves into `apps/web/features/admin`. With the last factory gone, shared-react drops its legacy exports. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Settings (the fifth feature)".

**Blocked by:** 25 (the `"."` export re-exports the contexts)

**Status:** ready-for-agent

- [ ] `shared-react/admin`, exported as `@norish/shared-react/admin`, holds the admin page's server data as plain hooks:
  - the admin config (`admin.getAllConfigs`), each card selecting what it draws, the job retention included, and each of its writes;
  - restoring a default, the endpoint tests, the secret read, the restart, the permission policies, and the auth providers (update, delete, test);
  - the job queue (list, summary, detail, its writes) and users (list, writes), polling as today;
  - AI-key rejections, which the shell's AI-key prompt reads too;
  - what admin cards called inline: page renderers, bulk enrichment, the catalogue clean-up and fill gaps, the cuisine vocabulary's writes, the available models and transcription models, and yt-dlp's version.

  Write side effects sit in `useMutation`'s own options. The config writes no longer mount a second observer of the config only to invalidate it.
- [ ] `AdminSettingsContext` goes, with its unread `refresh`. No admin card calls `useTRPC`. `createAdminHooks`, web's `hooks/admin/` and `settings/admin/hooks/use-cuisine-admin-mutations.ts` go.
- [ ] `features/admin` holds the admin screen and its cards, grouped by area. `settings/admin/page.tsx` renders it.
- [ ] shared-react's legacy exports go: `createUnitFormatter` moves beside `formatUnit` in `@norish/shared/lib/unit-localization` and its test with it; `useDirtyState` moves to web's `hooks/use-dirty-state.ts`; `src/hooks/`, `src/index.ts`, the `"."` and `./hooks` exports, the lint rule's `legacy` list, `exports.test.ts` and `hooks-exports.test.ts` go. No `create*Hooks` or `create*Context` remains in shared-react.
- [ ] Tests: the admin component tests mock the plain hooks and live in `features/admin/__tests__/`. The E2E specs `admin-user-management`, `secret-settings`, `page-renderers`, `prompt-default-reload`, `decision-model`, `image-generation`, `bulk-recipe-enrichment`, `catalogue-clean-up` and `catalogue-fill-gaps` pass.
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
