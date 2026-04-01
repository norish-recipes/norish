## 1. Data Model and Contracts

- [x] 1.1 Add a `recipe_shares` schema + migration with internal UUID id, `userId`, `recipeId`, unique `tokenHash`, lifecycle timestamps (`expiresAt`, `revokedAt`, `lastAccessedAt`), and `version`.
- [x] 1.2 Add shared zod/contracts for share expiry policies, share management DTOs, and the sanitized `PublicRecipeViewDTO`.
- [x] 1.3 Export the new schema/contracts through the existing `@norish/db` and `@norish/shared` surfaces.

## 2. Repository Layer

- [x] 2.1 Implement recipe-share repository helpers for create, get by id, get by token, get all by user id, get all, update, revoke, and delete using existing repository + optimistic-versioning patterns.
- [x] 2.2 Centralize active-share validation in the repository/helper layer so expired and revoked links are rejected consistently and successful public resolutions can update `lastAccessedAt`.
- [x] 2.3 Add a readonly public recipe mapper derived from recipe repository data that strips internal fields and emits share-scoped media URLs.

## 3. tRPC Procedures

- [x] 3.1 Add authenticated recipe-share management procedures for create/list/get/update/revoke/delete, enforcing recipe `edit` access before a user can manage a share.
- [x] 3.2 Add a `sharedRecipeProcedure` on top of `publicProcedure` that validates the share token, resolves the active share + recipe context, and powers anonymous shared-recipe reads.
- [x] 3.3 Wire the new router exports, input schemas, and response contracts so the backend exposes both management and anonymous read paths cleanly.

## 4. Proxy and Media Access

- [x] 4.1 Update `apps/web/proxy.ts` to allow `/share/*` and share-authorized recipe media requests through without relying on the current broad file-extension bypass.
- [x] 4.2 Update the recipe and step-media route handlers to validate share-token-authorized anonymous access and keep non-shared media protected.
- [x] 4.3 Apply share-aware cache headers for anonymous media responses so revocation and expiry take effect promptly.

## 5. Verification

- [x] 5.1 Add repository tests for token hashing, expiry handling, revocation, CRUD/list behavior, and `lastAccessedAt` updates.
- [x] 5.2 Add tRPC tests for share-management authorization, anonymous shared-recipe resolution, and uniform invalid/expired/revoked denial behavior.
- [x] 5.3 Add proxy/media route tests that prove shared media works anonymously with a valid share token and that unrelated recipe media stays protected.
