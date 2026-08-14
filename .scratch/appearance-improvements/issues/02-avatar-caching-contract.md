# 02 — Avatar caching contract: versioned immutable URLs

Status: ready-for-agent

**What to build:** ADR-0021, server side.

- Upload (`packages/trpc/src/routers/user/user.ts`) mints a **new filename per upload** (today `buildAvatarFilename(userId, ext)` yields one stable name) so a changed picture is a changed URL.
- The avatar route (`apps/web/app/(app)/avatars/[id]/route.ts`) switches from `Cache-Control: no-store` to long-lived immutable caching.
- Upload cleanup **retains the immediate predecessor file** instead of deleting all previous avatars, so payloads still holding the old URL render the old picture; the file after that is swept as today. Delete-avatar keeps deleting everything.
- The startup media-cleanup / avatar-cleanup jobs (`packages/shared-server/src/media/avatar-cleanup.ts`, `packages/api/src/startup/media-cleanup.ts`) must treat the retained predecessor as live, not an orphan.
- Upload and delete emit a `memberProfileUpdated` event on the existing household emitter (it already emits `allergiesUpdated` from this router) so open clients refetch user/member/recipe-author data and converge within seconds. No echo suppression: the actor's other tabs want it too.

**Done when:** replacing an avatar in an installed PWA shows the new picture without clearing site data; a second signed-in household member's open client converges without a manual reload; unit tests cover the retention rule and the emit; the repo gates pass.

## Comments
