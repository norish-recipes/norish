## Why

Norish recipes currently require authenticated access, which blocks a common household workflow: sending a recipe to someone outside the app. We need a backend-first public sharing model that exposes a recipe through a short-lived or permanent opaque link without exposing recipe ownership, raw tokens, or protected media paths.

## What Changes

- Add backend-managed public recipe share links that use a single opaque URL token (`/share/<token>`) instead of a database id in the URL.
- Add a new recipe-share persistence model with hashed token storage, expiration support (`1day`, `1week`, `1month`, `1year`, `forever`), revocation, update, delete, owner listing, and unfiltered admin-style retrieval.
- Add a public share-token validation flow in tRPC, including a dedicated share-token procedure/middleware path for anonymous access to shared recipes.
- Add a readonly public recipe mapping that exposes the fields needed for a public detail page without leaking internal mutable fields.
- Update web proxy/media access rules so public share pages can load recipe and step media without relying on broad file-extension bypasses.
- Add tests for token hashing, validation, expiration, revocation, public DTO mapping, and public media access behavior.

## Capabilities

### New Capabilities

- `public-recipe-sharing`: Create, manage, validate, and consume public recipe share links and the readonly recipe/media data they expose.

### Modified Capabilities

None.

## Impact

- Affected code: `packages/db` schema, repositories, and tests; `packages/shared` DTO and zod contracts; `packages/trpc` middleware and recipe-share procedures; `apps/web/proxy.ts`; and public recipe media route handling where required.
- Affected APIs: new authenticated share-management procedures plus new anonymous share-resolution/read procedures.
- Dependencies/systems: token hashing from `@norish/auth`, recipe repository mapping, Next.js proxy matching, and recipe media serving paths.
- Behavioral impact: recipes can be shared outside authenticated households through expiring or permanent opaque links while keeping database ids and raw token values out of persistent storage.
