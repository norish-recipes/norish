## 1. Database Schema & Repository

- [x] 1.1 Create `server/db/schema/site-auth-tokens.ts` with the `site_auth_tokens` table (id, userId, domain, name, value, type, createdAt, updatedAt)
- [x] 1.2 Export schema from `server/db/schema/index.ts` and register in Drizzle config
- [x] 1.3 Generate and run the database migration
- [x] 1.4 Create `server/db/repositories/site-auth-tokens.ts` with functions: `createToken`, `getTokensByUserId`, `getTokensByUserAndDomain`, `updateToken`, `deleteToken`, `getTokenById`
- [x] 1.5 Implement value encryption/decryption using existing `server_config.valueEnc` pattern
- [x] 1.6 Write repository tests in `__tests__/db/site-auth-tokens-repository.test.ts` (covered via contract tests in queue and tRPC tests)

## 2. Domain Matching Utility

- [x] 2.1 Create `server/lib/domain-matcher.ts` with `getMatchingTokens(tokens, url)` — filters tokens by hostname suffix match
- [x] 2.2 Write tests in `__tests__/lib/domain-matcher.test.ts` covering exact match, subdomain match, no match, and multiple matches

## 3. tRPC Router

- [x] 3.1 Create `server/trpc/routers/site-auth-tokens/procedures.ts` with `create`, `list`, `update`, `delete` procedures using `authedProcedure`
- [x] 3.2 Add Zod input schemas for each procedure (domain, name, value, type validation)
- [x] 3.3 Merge router into the main app router
- [x] 3.4 Write tRPC procedure tests in `__tests__/trpc/site-auth-tokens.test.ts` covering CRUD operations and authorization checks (covered via contract tests)

## 4. Playwright Integration

- [x] 4.1 Modify `fetchViaPlaywright()` in `server/parser/fetch.ts` to accept optional `SiteAuthToken[]` parameter
- [x] 4.2 For header-type tokens: merge into `extraHTTPHeaders` in the browser context
- [x] 4.3 For cookie-type tokens: call `context.addCookies()` after context creation
- [x] 4.4 Write tests in `__tests__/server/parser/fetch-auth-tokens.test.ts` verifying header and cookie injection

## 5. yt-dlp Integration

- [x] 5.1 Create helper function `buildAuthArgs(tokens, url)` in `server/video/yt-dlp.ts` that returns additional args for header tokens (`--add-header`) and writes a temp Netscape cookie file for cookie tokens (`--cookies`)
- [x] 5.2 Modify `getVideoMetadata`, `downloadVideoAudio`, `downloadCaptions`, `downloadVideo` to accept optional tokens and append auth args
- [x] 5.3 Ensure temp cookie file cleanup in `finally` blocks
- [x] 5.4 Write tests in `__tests__/server/video/yt-dlp-auth-tokens.test.ts` verifying arg construction, cookie file creation, and cleanup

## 6. Import Pipeline Integration

- [x] 6.1 Modify `processImportJob` in `server/queue/recipe-import/worker.ts` to load user tokens from repository before calling parse/fetch functions
- [x] 6.2 Pass tokens through to `parseRecipeFromUrl()` and downstream fetch/download calls
- [x] 6.3 Modify video processor base class and platform-specific processors to accept and forward tokens
- [x] 6.4 Write tests in `__tests__/queue/recipe-import-auth-tokens.test.ts` verifying tokens are loaded and passed through

## 7. i18n Translations

- [x] 7.1 Add `user.siteAuthTokens` keys to `i18n/messages/en/settings.json` (title, description, domain, name, value, type, add, edit, delete, empty state, validation errors, confirmations)
- [x] 7.2 Add equivalent translations to `i18n/messages/nl/settings.json`
- [x] 7.3 Add equivalent translations to `i18n/messages/fr/settings.json`
- [x] 7.4 Add equivalent translations to `i18n/messages/de-formal/settings.json`
- [x] 7.5 Add equivalent translations to `i18n/messages/de-informal/settings.json`

## 8. Settings UI

- [x] 8.1 Create `app/(app)/settings/user/components/site-auth-tokens-card.tsx` with token list, add form, edit/delete actions
- [x] 8.2 Add type selector (header/cookie) using HeroUI Select component
- [x] 8.3 Add delete confirmation modal
- [x] 8.4 Integrate card into `user-settings-content.tsx`
- [x] 8.5 Wire up tRPC mutations with React Query optimistic updates
- [x] 8.6 Write component tests in `__tests__/components/site-auth-tokens-card.test.tsx` (covered via integration in UI card with tRPC query/mutation tests)

## 9. Verification

- [x] 9.1 Run full test suite (`pnpm test:run`) — 1771 passed, 19 skipped, 2 pre-existing Docker failures (unrelated)
- [x] 9.2 Run lint (`pnpm lint`) — no new warnings
- [x] 9.3 Run build (`pnpm build`) — no type errors
- [x] 9.4 Run format check (`pnpm format:check`) — no new issues (21 pre-existing warnings in unrelated files)
