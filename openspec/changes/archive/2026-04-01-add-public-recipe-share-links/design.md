## Context

Recipes are currently fetched through authenticated tRPC procedures and recipe media is served from Next route handlers that are protected indirectly by `apps/web/proxy.ts`. The repo already has the primitives we need for a secure sharing design: `publicProcedure` for anonymous tRPC access, `hashToken()` for one-way token storage, repository patterns with optimistic versioning, and `getRecipeFull()` as the closest existing readonly recipe assembly path.

This change introduces a new backend capability that lets an authenticated user create a public recipe link while keeping raw secrets out of the database and avoiding a blanket unauthenticated bypass for all recipe media. The design also needs to stay backend-first: no mobile work and no share-page UI implementation in this change, aside from the proxy and server-side media behavior needed to support later share-page work.

## Goals / Non-Goals

**Goals:**

- Add a secure public recipe sharing model based on a single opaque token URL (`/share/<token>`).
- Store only a hashed token at rest while supporting revocation and configurable expiration.
- Add authenticated share-management APIs and anonymous share-consumption APIs.
- Add a sanitized readonly recipe DTO suitable for a public recipe detail page.
- Allow shared recipe media to load anonymously without making all recipe media public.
- Keep expiration and revocation checks centralized so the same validation rules apply across procedures and media routes.

**Non-Goals:**

- Building the actual web share page UI or any mobile share flows.
- Adding SEO indexing, social crawler metadata, or analytics for share-link traffic.
- Redesigning recipe ownership or the existing recipe permission policy system.
- Introducing downloadable exports or offline share bundles.

## Decisions

1. Use a single opaque token in the public URL and keep the database id internal.
   - Decision: public URLs use `/share/<token>`, while the share row still gets an internal UUID id for repository and management operations.
   - Rationale: this keeps the public URL as short as possible and avoids exposing a second identifier that adds little value once the token itself is high-entropy.
   - Alternative considered: `/share/<shareId>?token=<token>`. Rejected because it lengthens the URL, requires an extra public identifier column, and does not materially improve security if the token remains the actual secret.

2. Model shares as a dedicated `recipe_shares` table with hashed token storage and lifecycle metadata.
   - Decision: add a new table with at least `id`, `userId`, `recipeId`, `tokenHash`, `expiresAt`, `revokedAt`, `lastAccessedAt`, `createdAt`, `updatedAt`, and `version`.
   - Rationale: this matches repo conventions, supports CRUD/revocation flows, and gives enough state for validation and operational visibility without persisting the raw token.
   - Details: `tokenHash` is unique and derived with `hashToken()`. `expiresAt = null` represents `forever`. `lastAccessedAt` is updated on successful public resolution so operators can inspect usage without needing a separate analytics system.
   - Alternative considered: storing an encrypted token. Rejected because the server never needs to recover the raw token after creation.

3. Treat share creation as an authenticated management action that requires recipe edit access.
   - Decision: share-management procedures use `authedProcedure`, link the created share row to `ctx.user.id`, and require the caller to have recipe `edit` access before creating or mutating a share.
   - Rationale: `view` access would allow users to re-share recipes they can merely see, which is too permissive for a public-link feature. `edit` aligns better with ownership/control while still fitting the existing permission model.
   - Alternative considered: owner-only sharing. Rejected for now because the current permission model already encodes household edit rules and this change does not introduce a separate share permission system.

4. Introduce a dedicated share-token validation path for anonymous reads.
   - Decision: add a `sharedRecipeProcedure` built on `publicProcedure` plus share-token middleware/helper. The middleware hashes the incoming token, loads the active share, verifies it is not expired or revoked, loads the linked recipe, and attaches share context to `ctx`.
   - Rationale: this mirrors the repo's existing procedure-wrapper pattern while keeping share validation reusable across anonymous tRPC procedures.
   - Details: active-share lookup should live in the repository layer so expiration and revocation checks stay centralized and media routes can reuse the same validation helper.
   - Alternative considered: resolving the token ad hoc in each procedure. Rejected because it would duplicate security checks and make media-route validation drift more likely.

5. Add a dedicated public recipe DTO instead of exposing `FullRecipeDTO` directly.
   - Decision: create a new readonly `PublicRecipeViewDTO` and mapping path derived from `getRecipeFull()` semantics but stripped of internal mutable fields.
   - Rationale: `FullRecipeDTO` includes fields that are useful for authenticated editing but not appropriate for a public contract, such as `userId`, `version`, and nested item versions.
   - Details: the public DTO should include recipe content needed for a readonly page: title, description, notes, timings, servings, nutrition, categories, tags, ingredients, steps, gallery media, source URL, and a sanitized author block. It should exclude internal ids/versions that are not needed for rendering. Media URLs returned from this DTO should be share-scoped so they can be fetched anonymously without broadening access to unrelated recipe media.
   - Alternative considered: returning `FullRecipeDTO` and asking the share page to ignore internal fields. Rejected because the backend contract should define the public surface explicitly.

6. Gate anonymous media access with the share token instead of making `/recipes/*` globally public.
   - Decision: update the recipe and step-media route handlers so anonymous access is allowed only when the request carries a valid share token tied to the recipe being requested. Update `apps/web/proxy.ts` to allow `/share/*` and share-scoped media requests through without relying on the current broad extension-based matcher bypass.
   - Rationale: bypassing auth for all `/recipes/*` requests would let unshared media become fetchable by guessed paths. A share-token-aware path keeps access aligned to the share capability itself.
   - Details: the proxy should move from extension-based public matching toward explicit public paths/assets. Shared media responses should not keep the current long-lived immutable cache headers because revoked or expired shares need to stop working promptly; use short-lived or non-cacheable headers for share-token-authorized responses.
   - Alternative considered: leaving `/recipes/*` public once proxy is loosened. Rejected because it weakens media protection outside the share feature.

7. Raw share tokens are returned only at creation time.
   - Decision: create procedures return the generated public URL/token once, while list/get/update procedures return only metadata and status.
   - Rationale: hashed-only storage means the token cannot be recovered later, which is a feature, not a limitation. If the product later needs “regenerate link”, that should mint a new token rather than attempt recovery.
   - Alternative considered: storing a reversible token copy for later display. Rejected because it expands secret exposure without a current product need.

## Risks / Trade-offs

- [Share-token media URLs can be copied independently of the share page] -> Mitigation: this is acceptable because possession of the share token is the authorization model; revoke and expiry still invalidate future origin fetches.
- [Public media caching could outlive revocation] -> Mitigation: avoid immutable caching for share-token-authorized media responses and prefer short-lived or `no-store` cache headers.
- [Household collaborators with recipe edit access can create public links] -> Mitigation: document that behavior in the spec and revisit with a dedicated share-permission policy only if product needs stricter ownership rules.
- [Public DTO drift from authenticated recipe DTO] -> Mitigation: keep the public mapper close to the existing recipe repository assembly path and add contract tests for omitted fields.
- [Anonymous token probing against the public endpoint] -> Mitigation: use high-entropy opaque tokens, unique token hashes, identical not-found behavior for invalid/expired/revoked links, and structured logging without returning validation detail to callers.

## Migration Plan

1. Add the new database table, indexes, zod/contracts, and repository helpers.
2. Add authenticated share-management procedures and anonymous share-validation/read procedures.
3. Add the public recipe DTO/mapping and wire public procedures to that contract.
4. Update proxy/media handling so shared page and media requests can pass without the existing broad extension matcher.
5. Add repository, router, and media-route tests for token hashing, expiry, revocation, DTO sanitization, and anonymous access rules.

Rollback strategy:

- Disable the new tRPC procedures and remove the proxy/share-media allow paths.
- The schema change is additive, so rollback does not require touching existing recipe data.

## Open Questions

- None. The public URL shape is fixed to `/share/<token>` for this change.
