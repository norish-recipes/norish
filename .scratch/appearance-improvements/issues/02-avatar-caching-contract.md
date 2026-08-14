# 02 — Avatar caching contract: versioned immutable URLs

Status: resolved

**What to build:** ADR-0021, server side.

- Upload (`packages/trpc/src/routers/user/user.ts`) mints a **new filename per upload** (today `buildAvatarFilename(userId, ext)` yields one stable name) so a changed picture is a changed URL.
- The avatar route (`apps/web/app/(app)/avatars/[id]/route.ts`) switches from `Cache-Control: no-store` to long-lived immutable caching.
- Upload cleanup **retains the immediate predecessor file** instead of deleting all previous avatars, so payloads still holding the old URL render the old picture; the file after that is swept as today. Delete-avatar keeps deleting everything.
- The startup media-cleanup / avatar-cleanup jobs (`packages/shared-server/src/media/avatar-cleanup.ts`, `packages/api/src/startup/media-cleanup.ts`) must treat the retained predecessor as live, not an orphan.
- Upload and delete emit a `memberProfileUpdated` event on the existing household emitter (it already emits `allergiesUpdated` from this router) so open clients refetch user/member/recipe-author data and converge within seconds. No echo suppression: the actor's other tabs want it too.

**Done when:** replacing an avatar in an installed PWA shows the new picture without clearing site data; a second signed-in household member's open client converges without a manual reload; unit tests cover the retention rule and the emit; the repo gates pass.

## Comments

- 2026-08-14: Implemented. Notes against the ticket bullets:
  - The versioned filename half already existed (`buildAvatarFilename` has minted `${userId}-${timestamp}.${ext}` since Feb 2026, commit 75523a0d) — the ticket's "one stable name" premise was stale. What was missing was everything downstream: the route still served `no-store`, and upload deleted *all* previous files before writing.
  - `/avatars/[id]` now serves `Cache-Control: private, max-age=31536000, immutable` (`private` because the route sits behind the auth proxy); 404s stay `no-store`.
  - Upload reads the DB-referenced filename first (fresh `getUserById`, not the session snapshot), writes the new file, updates the DB, and only then sweeps — keeping the new file plus the immediate predecessor (new `sweepUserAvatars(userId, keep)` in `packages/shared-server/src/media/avatar-cleanup.ts`, plus `avatarFilenameFromImagePath` in shared helpers). Sweeping after the version-checked DB update also fixes the pre-existing hazard where a stale upload had already deleted every old file. Delete and account-deletion sweep everything.
  - `cleanupOrphanedAvatars` already treats every file of a user with a stored avatar as live (so the predecessor was never an orphan); pinned by a new test rather than changed.
  - `memberProfileUpdated` (`{userId, image|null}`) emits household-scoped on upload and delete, no echo suppression; new `onMemberProfileUpdated` subscription follows the allergies pattern; client dispatch in shared-react invalidates `user.get` (own event only) and the recipes path-key (author chips) — web and mobile both bind the shared factory.
  - Tests: `user-avatar-contract.test.ts` (9 cases, real router via `createCaller`: minting, retention order, emits, stale paths, no-household), `avatar-cleanup.test.ts` (sweep rules), `avatar-cleanup-retention.test.ts` (startup job), route cache-header test flipped from its old `no-store` assertion, subscription handler test extended.
  - The installed-PWA acceptance check (replace avatar, no site-data clear) is a manual browser check that rides on the E2E harness being green; not separately automated here.
