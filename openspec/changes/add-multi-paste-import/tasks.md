## 1. API And Queue Contracts

- [x] 1.1 Update the paste import tRPC input and response schemas to keep the existing endpoint but return `{ recipeIds: string[] }` for single and multi-imports.
- [x] 1.2 Update the paste import queue/job payload and result types so one request can execute as one batch job and return multiple created recipe IDs.
- [x] 1.3 Update first-party callers that still expect a single returned recipe ID.

## 2. Structured Paste Parsing And Normalization

- [x] 2.1 Extend the Node-side paste parser to detect and extract recipe nodes from single JSON-LD objects, top-level arrays, and `@graph` payloads.
- [x] 2.2 Add YAML parsing for a single recipe mapping and arrays of recipe mappings, including alias handling for `image`/`images` and `video`/`videos`.
- [x] 2.3 Normalize supported YAML fields into the existing recipe DTO, including tags, categories, timings, nutrition, notes, and source URL.
- [x] 2.4 Enforce structured import validation rules and limits, including ordered arrays for ingredients and steps, max recipe count, and existing payload-size protection.
- [x] 2.5 Preserve AI fallback for unstructured text while bypassing AI for valid structured JSON-LD or YAML unless `forceAI` is enabled.

## 3. Batch Creation And Ratings

- [x] 3.1 Implement batch worker execution that validates detected recipes independently, creates all valid recipes, and fails only when no valid items remain.
- [x] 3.2 Preserve source-item order in the returned `recipeIds` for successfully created recipes.
- [x] 3.3 Map imported structured `rating` values into authenticated-user Norish ratings using whole-number rounding, clamping, and overwrite-on-conflict behavior.
- [x] 3.4 Ensure imported ratings update `averageRating` and `ratingCount` through the existing ratings repository flow rather than custom aggregate logic.

## 4. Web Paste Import UX

- [x] 4.1 Update the web paste import modal flow to handle a batch-capable response and create one pending placeholder per returned recipe ID.
- [x] 4.2 Update recipe skeleton handling so each batch-created recipe gets its own temporary slot until full card data resolves.
- [x] 4.3 Verify the single-recipe paste flow still behaves correctly when only one recipe ID is returned.

## 5. Documentation And Verification

- [x] 5.1 Update Scalar/OpenAPI documentation and examples for JSON-LD single, JSON-LD multiple, YAML single, and YAML multiple payloads.
- [x] 5.2 Add automated coverage for parser extraction, normalization, validation, partial-success behavior, and AI fallback decisions.
- [x] 5.3 Add automated coverage for rating import normalization and authenticated-user rating persistence.
- [x] 5.4 Add automated coverage for the updated tRPC contract, queue result handling, and multi-skeleton UI behavior.
