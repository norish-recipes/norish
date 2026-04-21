## Context

Norish already ships public recipe sharing at the backend and shared-react layers, and the web app uses those APIs to create `/share/<token>` links. The mobile recipe detail action menu still calls `Share.share` with `recipe.url`, which usually points to the imported source recipe instead of a Norish-controlled public page.

The mobile screen already consumes recipe detail context and has access to the shared-react recipe-share hooks through the existing mobile hook bundle. The main constraint is that existing share-list APIs intentionally do not return raw tokens, so mobile cannot reconstruct or reuse a previously created share URL from list data.

The current shared-react share mutation contract also treats `createShare` as fire-and-forget, which is sufficient for cache invalidation but not for a UI flow that must immediately open a native share sheet with the created URL.

## Goals / Non-Goals

**Goals:**
- Make the mobile Share action send Norish-owned public share URLs through the native platform share sheet.
- Reuse the existing public share backend, shared-react hooks, and `/share/<token>` route instead of adding a mobile-only sharing backend.
- Keep the first mobile version simple by creating non-expiring (`forever`) links without new expiry-selection UI.
- Preserve the separate Visit Original action for source URLs.

**Non-Goals:**
- Adding mobile UI for choosing expiration policies.
- Building a mobile share-link management surface for listing, revoking, or deleting links.
- Changing backend token-storage rules or exposing raw tokens through list endpoints.

## Decisions

### Create a new `forever` share link when the mobile user taps Share

The mobile share action will call the existing share-create mutation with `expiresIn: "forever"`, then pass the returned public URL into the native share sheet.

Why this approach:
- It uses an existing server contract that already returns the raw share URL at creation time.
- It avoids adding mobile-only backend endpoints or expanding the share inventory response surface.

Alternative considered:
- Reuse an existing active share link. Rejected for now because existing list/query responses intentionally exclude raw token values, so mobile cannot rebuild a usable public URL from current data.

### Extend the shared-react share creation contract to expose the created share payload

The shared-react recipe-share mutation layer and recipe detail context will expose an async share-creation path that resolves the server response, including the newly created public share URL.

Why this approach:
- It keeps mobile on the same shared-react recipe-share contract already used for share state, cache invalidation, and recipe detail context wiring.
- It avoids introducing a one-off direct tRPC call path in the mobile component for a domain the repo already centralizes in shared-react.

Alternative considered:
- Call `trpc.recipes.shareCreate` directly from `apps/mobile`. Rejected because it duplicates share-domain wiring in app code and weakens the shared contract between web and mobile.

### Keep the share flow inside the mobile recipe detail action menu

The current mobile UX already has a single Share entry point in `recipe-actions-menu.tsx`. The change will replace the current source-URL sharing logic with an async flow that creates the Norish share link first, then opens the native share sheet.

Why this approach:
- It is the smallest change that fixes the user-facing behavior.
- It keeps sharing localized to the existing recipe action surface instead of introducing a new panel or sheet.

Alternative considered:
- Add a dedicated mobile share-management screen first. Rejected because the immediate problem is incorrect outgoing URLs, not lifecycle management.

### Treat share creation failure as a share failure, not a fallback to the source URL

If share-link creation fails, mobile will show an error state and stop instead of falling back to `recipe.url`.

Why this approach:
- The product requirement is to share Norish URLs, not the original imported URL.
- Silent fallback would keep the current incorrect behavior and make failures harder to notice.

Alternative considered:
- Fall back to sharing `recipe.url`. Rejected because it breaks the intended public-share experience and bypasses Norish access controls.

## Risks / Trade-offs

- [Repeated share taps create multiple `forever` links] -> Accept in v1, since the current API returns reusable raw URLs only on creation; revisit if link sprawl becomes a real operational issue.
- [Extra network round-trip before the share sheet opens] -> Show pending state in the share action and keep the flow scoped to one mutation before invoking the native sheet.
- [Native share sheet cancellation after link creation leaves an unused public link] -> Accept in v1 because links are revocable later and the alternative would require pre-share draft semantics the backend does not support.
- [Share creation errors can block sharing while offline or during backend issues] -> Surface a clear mobile error instead of silently sharing the wrong URL.

## Migration Plan

No data migration is required. Deploy the mobile client update after confirming the existing share-create mutation is available in production for mobile sessions.

Rollback is low risk: reverting the mobile action menu restores the old source-URL share behavior without affecting existing public share links.

## Open Questions

- None for v1. If product later wants link reuse or expiry selection on mobile, that should be handled in a follow-up change.
