## Context

Norish already supports paste import through a single endpoint, queue job, and web modal, but the current structured path is intentionally narrow: it wraps pasted text in a JSON-LD script tag, normalizes the first detected recipe node, and otherwise falls back to AI. The requested change cuts across the tRPC contract, OpenAPI docs, queue payload/result shape, parser and normalization logic, rating persistence, and web optimistic placeholder behavior.

This change also needs explicit product decisions where the current system has none: how a structured multi-import should execute, what happens when only some pasted items are valid, and how imported ratings map into Norish's existing whole-number user rating model. The Python `recipe-scrapers` service remains the wrong boundary for raw pasted structured text because it expects HTML plus URL and would add unnecessary translation complexity for YAML input.

## Goals / Non-Goals

**Goals:**
- Keep paste import on the existing endpoint while making the request and response batch-capable.
- Parse valid JSON-LD and YAML directly in Norish's Node-side paste pipeline without requiring AI.
- Support single and multiple recipes from one pasted payload.
- Reuse Norish's existing recipe creation and rating repositories so imported ratings affect `averageRating` and `ratingCount` the same way as ordinary user ratings.
- Define deterministic limits, partial-success rules, and rating normalization behavior.
- Preserve the current AI fallback path for plain unstructured text when AI is enabled.

**Non-Goals:**
- Routing pasted structured text through the Python parser service.
- Adding a separate batch paste endpoint.
- Expanding rating precision beyond Norish's existing whole-number model.
- Designing a new custom plain-text parser format beyond JSON-LD and YAML.
- Changing URL import behavior outside any shared normalization helpers reused by paste import.

## Decisions

### Use a single batch-capable paste import contract

The existing paste import endpoint will remain the entry point, but its success payload will become `{ recipeIds: string[] }`. A single imported recipe still returns one ID in that array.

Rationale:
- It keeps web and API usage on one mental model.
- It leaves room for future metadata without switching to a bare array response.
- It matches the product requirement that the same action can import one or many recipes.

Alternatives considered:
- Keep returning a bare UUID for single imports and introduce a second batch endpoint. Rejected because it duplicates import flows and pushes branching complexity to clients.
- Return a bare `string[]`. Rejected because it is less extensible than an object envelope.

### Parse structured paste in a Node-side format detector pipeline

The worker will detect structured input in this order when `forceAI` is not set: JSON-LD parse, YAML parse, then AI fallback for otherwise unstructured text. JSON-LD parsing will support a single object, top-level arrays, and `@graph` payloads by collecting every recipe node before normalization. YAML parsing will support either one mapping or an array of mappings and will normalize field aliases before DTO conversion.

Rationale:
- It preserves raw structured paste as a first-class Norish-owned contract.
- JSON-LD and YAML can be validated against Norish's needs before recipe creation.
- It avoids misusing the Python HTML parser boundary.

Alternatives considered:
- Send pasted JSON-LD through the Python parser by wrapping it into synthetic HTML. Rejected because it couples raw text imports to an HTML parser contract and still does not solve YAML.
- Try YAML before JSON-LD. Rejected because valid JSON is also valid YAML and would make structured JSON-LD detection less explicit.

### Execute one request as one batch job

One paste import request will enqueue one batch job containing the original text, import options, and authenticated user context. The worker will parse the payload once, normalize all candidate recipes, create all valid recipes in the same job, collect their IDs, and then return them together.

Rationale:
- Parsing and validation happen once per payload.
- Batch-level limits and partial-success accounting stay in one place.
- The authenticated importing user context is naturally shared for per-recipe rating upserts.

Alternatives considered:
- Fan out into one job per detected recipe. Rejected because it complicates ordering, partial-success reporting, and placeholder creation while adding queue overhead.

### Multi-import uses partial success with a no-valid-items failure floor

For structured multi-import, the worker will validate each detected recipe independently. Valid recipes will be created; invalid recipes will be skipped and recorded in job diagnostics. If at least one valid recipe is created, the endpoint result is successful and returns only the created IDs. If no valid recipes remain after validation, the import fails with a structured validation error instead of silently succeeding with an empty array.

Rationale:
- It matches the product decision that all valid recipes should be imported.
- It prevents one malformed item from blocking the whole payload.
- It avoids ambiguous success responses with zero created recipes.

Alternatives considered:
- Fail the entire payload on the first invalid item. Rejected because it contradicts the desired multi-import behavior.
- Return per-item errors in the public API response now. Rejected for this change to keep the contract minimal, though the object envelope leaves room for it later.

### YAML normalization maps into the existing internal recipe DTO

The YAML contract will keep `title` as the user-facing field and map it internally to the recipe name. `ingredients` and `steps` will require array semantics. `tags` may be either an array or a comma-separated string, while `image`/`video` are accepted as aliases for canonical `images`/`videos`. Nutrition will support `kcal`, `fat`, `carbs`, and `protein`. Categories, notes, timings, servings, media URLs, and `sourceUrl` will map through the existing normalization pipeline.

Rationale:
- YAML stays easy for humans to author.
- The contract is explicit enough for validation and docs.
- Reusing the existing DTO path minimizes downstream divergence from other import sources.

Alternatives considered:
- Support ad hoc comma-split parsing for ingredients and steps. Rejected because it is fragile and conflicts with the preferred structured format.

### Imported ratings become authenticated user ratings with whole-number normalization

Structured `rating` will not be stored as source metadata. After each recipe is created, the worker will use the authenticated importing user to create or update that user's Norish rating for the created recipe using the existing ratings repository flow. Because Norish only accepts whole-number ratings, imported fractional values will be rounded to the nearest supported whole number and clamped into the allowed range before persistence. If a rating already exists for the importing user and created recipe, the import will overwrite it so retries and repeat imports converge on the pasted value.

Rationale:
- It preserves a single ratings model and keeps aggregates consistent.
- It addresses the explicit product requirement that imported ratings belong to the importing user.
- Rounding is the most predictable interpretation of pasted decimals such as `4.5` in a whole-number system.

Alternatives considered:
- Store fractional ratings as separate source metadata. Rejected because product explicitly wants Norish user ratings.
- Reject fractional values. Rejected because the requested examples already use decimals and imports should remain ergonomic.
- Always floor or always ceil decimals. Rejected because nearest-whole rounding better preserves intent.

### Enforce batch limits in addition to the existing paste-size limit

The current `MAX_RECIPE_PASTE_CHARS` limit remains the outer payload-size guard. Structured parsing will add a maximum recipe count per payload so a single paste cannot create an unbounded number of recipes; the design target is 25 recipes unless the existing codebase exposes a stronger shared limit during implementation.

Rationale:
- Character limits alone do not bound work for many short recipes.
- A count cap keeps queue, DB, and UI work predictable.

Alternatives considered:
- No recipe-count limit. Rejected because structured arrays could otherwise create bursty queue and UI load.

### Web placeholders fan out from returned IDs, not optimistic guesses

The web modal will wait for the batch-capable response and then create one pending recipe placeholder per returned recipe ID using the same skeleton flow already used for single imports. This keeps placeholder identity aligned with actual created recipes and works for both one and many results.

Rationale:
- The server remains the source of truth for created entities.
- Placeholder lifecycle stays aligned with existing cache and skeleton replacement behavior.

Alternatives considered:
- Pre-allocate placeholders before import completes based on parsed client-side counts. Rejected because it duplicates parsing logic in the UI and can diverge from server validation.

## Risks / Trade-offs

- [Partial success hides invalid item details from the current API response] -> Record skipped-item diagnostics in job logs and keep the response envelope extensible for later warning payloads.
- [Rounding decimal ratings may surprise users expecting fractional persistence] -> Document whole-number normalization in Scalar/OpenAPI examples and the spec.
- [YAML parsing broadens accepted structured inputs and can increase validation edge cases] -> Restrict the accepted field set, require arrays for ingredients and steps, and fail invalid items explicitly.
- [Batch creation increases per-request workload] -> Parse once, enforce recipe-count limits, and keep creation inside one bounded job.
- [Response shape change can break existing single-import clients] -> Update first-party clients in the same change and document the new batch-capable response as the supported contract.

## Migration Plan

1. Update the shared paste import contract, queue payload/result types, and OpenAPI examples to the batch-capable schema.
2. Implement the worker-side structured parser and normalization flow with JSON-LD, YAML, limits, and partial-success handling.
3. Wire rating upserts for imported structured ratings through the existing repository flow.
4. Update the web modal and placeholder logic to fan out skeletons from returned `recipeIds`.
5. Ship tests across parser, queue, API, ratings, and web UI layers before rollout.

Rollback strategy:
- Revert the change to restore the single-import contract and current structured parsing path if batch behavior or rating import causes regressions.
- Because the same endpoint contract changes, rollback must include both server and first-party client changes together.

## Open Questions

- Whether the existing ratings repository already exposes the exact rounding/clamping helper needed for import normalization, or whether paste import should add a shared utility without duplicating rating rules.
- Whether the queue/job result path currently has a suitable place for skipped-item diagnostics if product later wants to surface warnings to the UI.
- Whether implementation should preserve input order strictly in returned `recipeIds` when some items are skipped; the preferred behavior is to keep successful IDs in the same relative order as their source items.
