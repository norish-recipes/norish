## Why

Paste import currently treats structured input as a single recipe and only recognizes a narrow JSON-LD path before falling back to AI. Norish now needs a first-class structured paste contract that can import one or many recipes from pasted JSON-LD or YAML, preserve user-authored metadata such as ratings, and let the UI represent batch imports without requiring AI for valid structured input.

## What Changes

- Add a dedicated `recipe-paste-import` capability covering structured paste import for single and multi-recipe payloads.
- Accept JSON-LD recipe payloads as a single object, arrays, or graphs containing multiple recipe nodes.
- Accept YAML recipe payloads as a single recipe object or an array of recipe objects, with documented field aliases such as `image` -> `images` and `video` -> `videos`.
- **BREAKING** Change the paste import API and queue/job contracts to support batch-capable responses using `{ recipeIds: string[] }` on the existing endpoint.
- Define worker parsing, normalization, validation, limits, and partial-failure behavior for structured paste imports while preserving AI fallback for unstructured text.
- Map imported structured `rating` values into Norish user ratings for the authenticated importing user, with explicit whole-number normalization and conflict handling.
- Update web paste import UX so a multi-import request creates one pending recipe skeleton per returned recipe ID.
- Update Scalar/OpenAPI examples and documentation for JSON-LD single, JSON-LD multi, YAML single, and YAML multi payloads.

## Capabilities

### New Capabilities
- `recipe-paste-import`: Structured recipe paste import for JSON-LD and YAML, including batch creation, rating import behavior, validation, fallback rules, and API documentation.

### Modified Capabilities
- `recipe-loading-skeletons`: Extend pending recipe placeholder behavior so paste imports can show one temporary skeleton per created recipe in a batch.

## Impact

- Affected API surface: paste import request/response contract in `packages/trpc`, generated OpenAPI types, and Scalar examples.
- Affected backend flow: paste import job payloads and results in `packages/queue`, parser and normalization logic in `packages/api`, and rating persistence through existing repository logic.
- Affected frontend flow: `apps/web/components/shared/import-from-paste-modal.tsx` and any related optimistic placeholder handling for newly created recipes.
- Affected validation and test coverage: parser, queue worker, ratings integration, tRPC contract, and web multi-skeleton behavior.
