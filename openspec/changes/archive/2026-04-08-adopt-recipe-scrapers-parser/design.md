## Context

Norish currently performs HTML recipe extraction inside the Node import pipeline using custom JSON-LD and microdata parsers, then falls back to AI extraction when structured parsing fails. The proposed change introduces a Python dependency (`recipe-scrapers`) and a second runtime while preserving the existing Node responsibilities for page fetching, site-auth token injection, queue orchestration, DTO persistence, and downstream event flow.

This is a cross-cutting change because it affects `packages/api`, `packages/queue`, deployment assets, runtime configuration, and test strategy. It also introduces an operational rollback requirement: the Python parser becomes the default immediately, but the legacy structured parser path must remain available behind a flag while it is being deprecated.

## Goals / Non-Goals

- Goals:
  - Make a Norish-owned Python parser API application under `apps/parser-api`, backed by the external `recipe-scrapers` package, the default structured parser backend for non-video URL recipe imports.
  - Keep HTML fetching, Playwright/browser behavior, and site-auth token handling in the existing Node pipeline.
  - Return a serialized `recipe-scrapers` model from Python and normalize it into Norish's `FullRecipeInsertDTO` inside Node.
  - Preserve the existing AI-only controls so `forceAI` and global `alwaysUseAI` continue to bypass structured parser backends entirely.
  - Surface structured parser failure reasons from Python and use a Node-side recipe-likeliness check only to decide whether AI fallback should run after parser failure.
  - Preserve the existing queue, persistence, event emission, auto-tagging, allergy detection, and AI fallback flow after structured extraction, without regressing current media support.
  - Keep the legacy JSON-LD and microdata parser path available behind an explicit boolean rollback flag and mark that code as deprecated.
  - Define a maintainable upgrade path for the Python dependency with pinned versions and regression coverage.

- Non-Goals:
  - Replacing video, paste, or image recipe imports.
  - Moving page fetching or auth-token injection into Python.
  - Removing the legacy parser implementation in this change.
  - Introducing an admin UI toggle for backend selection in the first release.
  - Automatically floating `recipe-scrapers` to the newest release without validation.

## Decisions

### Application boundary: deployable parser app in the monorepo

- **Decision:** Treat `recipe-scrapers` as an external Python package dependency and build a separate Norish-owned parser API application under `apps/parser-api` in the monorepo.
- **Rationale:** `recipe-scrapers` is a library, not a deployable Norish service. Norish still needs its own HTTP contract, request validation, health checks, logging, version visibility, and future room for project-specific parsing behavior. Modeling this explicitly as a Norish app wrapping an external package makes ownership and upgrade responsibility clear.
- **Alternatives considered:**
  - Call `recipe-scrapers` directly from Node through subprocess wrappers: feasible, but weaker process isolation and service ownership.
  - Model it explicitly as a required sidecar container: workable, but too deployment-specific for the long-term monorepo direction.
  - Embed Python into the main Norish runtime container as the only supported shape: possible, but too constraining for an environment-agnostic design.

### Dependency management: pinned `recipe-scrapers` version with explicit upgrade workflow

- **Decision:** Pin `recipe-scrapers` to a specific version in the parser API's Python dependency manifest and committed lockfile, and update it intentionally through a documented upgrade workflow backed by regression tests.
- **Rationale:** This keeps behavior stable and answers the maintenance concern directly: the dependency stays current through deliberate upgrades rather than silent drift. Each upgrade can be validated against a curated import fixture set before becoming the new pinned version. The Norish app owns the upgrade cadence; upstream package releases do not change production behavior until Norish explicitly adopts them.
- **Alternatives considered:**
  - Floating to latest compatible release automatically: lower maintenance effort, but too risky for a parser that may change site behavior between releases.
  - Vendoring `recipe-scrapers` source: maximum control, but it defeats the point of adopting the upstream library.

### Upgrade ownership: scheduled dependency review with parser regression verification

- **Decision:** Treat `recipe-scrapers` updates as a routine dependency maintenance task for the parser API, verified by contract tests, fixture-based import tests, and documented representative manual URL spot checks before merging.
- **Rationale:** The package will only remain useful if Norish actively maintains it. A lightweight but explicit review workflow makes that responsibility concrete without requiring immediate upstream adoption on every release.
- **Alternatives considered:**
  - Upgrade only when imports break: lowest effort, but encourages long periods of drift and harder catch-up upgrades.
  - Mirror upstream release cadence exactly: fresher, but likely too noisy for a parser dependency with behavior changes across many sites.

### Transport contract: FastAPI over HTTP returning a serialized scraper model and structured failure codes

- **Decision:** Expose the Python parser application through FastAPI and send `url` plus fetched `html` in the request body. The parser API returns either a successful serialized `recipe-scrapers` model plus metadata such as parser version, selected scraper host, and canonical URL when available, or a machine-readable parser failure code. The failure response should preserve useful upstream categories such as `WebsiteNotImplementedError`, `NoSchemaFoundInWildMode`, and `RecipeSchemaNotFound` rather than inventing a fake upstream `not_recipe` result.
- **Rationale:** FastAPI provides typed request/response validation with minimal ceremony, and returning the scraper model instead of Norish DTOs keeps domain normalization in Node where existing unit, ingredient, and media handling already live. Structured failure codes are more defensible than assuming `recipe-scrapers` can conclusively identify non-recipe pages.
- **Alternatives considered:**
  - Return a Norish-specific DTO directly from Python: tighter coupling and duplicated domain knowledge across languages.
  - Use gRPC or a queue-based boundary: unnecessary complexity for a small internal service.

### Selection precedence: AI-only controls override structured backend selection

- **Decision:** Preserve the current AI-only controls as the highest-precedence path. If `forceAI` is requested for an import, or if global `alwaysUseAI` is enabled, Norish skips both Python and legacy structured parsers and uses the AI extraction path directly. If AI-only mode is not active, the legacy rollback flag selects the deprecated legacy parser; otherwise the Python parser is the default structured backend.
- **Rationale:** This keeps existing product controls stable while making the Python backend the default structured parser rather than a replacement for AI-only mode.
- **Alternatives considered:**
  - Let the legacy rollback flag override AI-only mode: inconsistent with current behavior and harder to reason about operationally.
  - Remove `forceAI` and `alwaysUseAI` as part of this change: unnecessary scope expansion.

### Recipe detection boundary: no pre-parser gate, but gate AI fallback after parser failure

- **Decision:** Remove the existing `isPageLikelyRecipe()` heuristic from the default Python parser path so the Python backend always gets the fetched HTML first. If Python parsing fails and AI is enabled, run the recipe-likeliness heuristic only at the AI handoff boundary to avoid sending clearly non-recipe pages into AI extraction.
- **Rationale:** The old Node-side heuristic can reject pages before the new parser has a chance to inspect them, which would undercut the purpose of adopting `recipe-scrapers` for broader site support. Reusing the heuristic only before AI fallback keeps that protection where it is most useful without blocking the Python parser.
- **Alternatives considered:**
  - Keep the heuristic in front of the Python service: lower request volume, but it risks false negatives and duplicates recipe-detection logic across runtimes.
  - Never gate AI fallback after parser failure: simpler, but more likely to waste AI calls on obvious non-recipe pages.

### Fetch ownership: Node fetches, Python parses

- **Decision:** Keep page fetching in Node using the existing Playwright-based HTML fetcher and current token-aware behavior, then send the resulting HTML and source URL to the dedicated parser API.
- **Rationale:** `recipe-scrapers` is strongest as an HTML parser, not a browser automation or auth-aware fetcher. Preserving fetch ownership in Node avoids duplicating site-auth logic and keeps protected-site handling aligned with the existing pipeline.
- **Alternatives considered:**
  - Let the Python service fetch remote URLs directly: duplicates request handling, browser/auth concerns, and deployment complexity.
  - Split responsibilities dynamically per site: adds routing complexity without clear benefit for the first version.

### Normalization boundary: Node adapts scraper output into `FullRecipeInsertDTO`

- **Decision:** Add a Node adapter that converts the serialized `recipe-scrapers` response into Norish's DTO format, reusing existing ingredient parsing, step shaping, category/tag enrichment where appropriate, and downstream save flow.
- **Rationale:** Norish already has the DTO contracts, ingredient parsing helpers, image handling, and AI fallback decisions. Keeping adaptation in Node minimizes duplicate business logic and lets the Python service stay generic.
- **Alternatives considered:**
  - Duplicate normalization logic in Python: harder to keep aligned with TypeScript contracts and existing downstream behavior.

### Structured result validity: require title, ingredients, and steps

- **Decision:** Treat the Python parser result as usable only when the normalized recipe contains the minimum fields Norish already needs for a valid imported recipe: title, at least one ingredient, and at least one step.
- **Rationale:** This preserves the current structured-import quality bar and avoids saving partial recipe shells when the upstream scraper returns incomplete data.
- **Alternatives considered:**
  - Accept partial structured recipes and rely on downstream repair: too likely to create low-quality imports.
  - Require broader metadata parity before accepting a parse: stricter than the current import contract.

### URL persistence: prefer canonical URL when the scraper exposes one

- **Decision:** Persist the scraper-reported canonical URL when available; otherwise persist the originally requested URL. This change does not introduce a second duplicate check after parsing; pre-parse duplicate checks continue to use the originally requested URL.
- **Rationale:** Canonical URLs improve downstream consistency across tracking params or alternate entry URLs, but Norish does not need to widen this change into a second post-parse dedupe pass.
- **Alternatives considered:**
  - Always persist the requested URL: simpler, but loses canonicalization benefits already exposed by the scraper.
  - Always require a canonical URL from Python: too strict for sites or parser results that do not provide one.

### Media parity: keep current structured-import media behavior without adding new media heuristics in Node

- **Decision:** The adapter must preserve current structured-import expectations for primary image, additional images when available, and embedded recipe-page videos when available. The Python service returns media metadata and URLs, and Node continues downloading and storing those assets through the existing Norish media pipeline rather than persisting remote parser URLs directly.
- **Rationale:** The current structured parser path already produces Norish-managed media assets. Adopting `recipe-scrapers` should not quietly regress recipe imports to external-only media references or otherwise change storage ownership.
- **Alternatives considered:**
  - Only keep a primary image in v1: smaller scope, but a meaningful regression from the current parser behavior.
  - Persist remote media URLs directly from Python: smaller implementation surface, but a behavior change from the current import path.
  - Rebuild custom image selection heuristics in Node: duplicates behavior that should live behind the parser boundary.

### Instruction fidelity: preserve ordered steps, treat section structure as best-effort

- **Decision:** The adapter should preserve an ordered multi-step recipe whenever the scraper exposes separable instructions, preferring structured step lists over splitting a flat instruction string. Exact preservation of current JSON-LD `HowToSection` grouping is not required in this change.
- **Rationale:** Ordered steps are core recipe behavior, while section/group preservation is a quality improvement that `recipe-scrapers` may not expose consistently across sites.
- **Alternatives considered:**
  - Require exact section/heading parity with current JSON-LD parsing: too strict for the new library contract.
  - Collapse all instructions into one note field: unacceptable regression in cooking flow.

### Category and tag mapping: conservative categories with explicit synonyms, broader metadata-derived tags

- **Decision:** Map Norish meal categories only when scraper fields clearly indicate a supported meal category or an explicit close synonym that Norish intentionally treats as equivalent, such as `Brunch` -> `Breakfast`, `Supper` -> `Dinner`, and `Appetizer`, `Dessert`, or `Side Dish` -> `Snack`; otherwise leave categories empty so existing auto-categorization can run. Normalize scraper metadata such as `keywords`, `category`, `cuisine`, and dietary restriction fields into Norish tags with lowercase trim-and-dedupe rules.
- **Rationale:** Norish categories are intentionally narrow, while scraper metadata is broad and site-specific. Restricting mappings to explicit supported categories and a short synonym list keeps behavior predictable without throwing away useful meal signals.
- **Alternatives considered:**
  - Aggressively infer meal categories from weak signals: higher coverage, but too error-prone.
  - Ignore scraper metadata beyond ingredients and steps: simpler, but throws away useful classification data.

### Rollback control: explicit boolean env flag with Python as the default

- **Decision:** Introduce an environment-controlled boolean rollback flag that keeps the Python backend as the default and enables the legacy parser path only when explicitly turned on. The legacy JSON-LD and microdata code remains in place, marked `@deprecated`, and is only used when the rollback flag is enabled.
- **Rationale:** The user wants the new path to become default immediately while keeping a simple operational kill switch. A boolean env flag is available before the app starts and works even if the parser service is failing.
- **Alternatives considered:**
  - Admin-config runtime toggle: more flexible, but slower as an operational rollback mechanism and unnecessary for the initial rollout.
  - Automatic Python-to-legacy fallback on every failure: masks parser issues and makes behavior harder to reason about.

### Failure behavior: preserve AI fallback for parser failures only when the page remains recipe-like

- **Decision:** When the parser service returns a structured parser failure code, the pipeline does not automatically fall through to the legacy parser. If AI is enabled, Norish runs the existing recipe-likeliness heuristic against the fetched page before AI fallback; pages that still appear recipe-like continue to AI extraction, while pages that fail that eligibility check hard-fail instead. If AI is disabled, the import fails immediately.
- **Rationale:** Upstream parser exceptions are a better fit than assuming a conclusive `not_recipe` signal. Gating AI fallback on recipe-likeliness preserves resilience for likely recipe pages while avoiding AI imports for obvious non-recipe content.
- **Alternatives considered:**
  - Python -> legacy -> AI fallback chain: more permissive, but adds branching complexity and makes it harder to tell which backend actually produced the recipe.
  - AI fallback for every parser failure regardless of page shape: more permissive, but too likely to create garbage imports from non-recipe content.

## Risks / Trade-offs

- **Parser inconsistency across sites** -> Mitigated by keeping the legacy backend behind an env flag, pinning `recipe-scrapers`, adding regression tests for representative recipes, and documenting representative manual spot checks for release validation.
- **Operational overhead from a new runtime** -> Mitigated by using a dedicated parser API with health checks, documented service wiring, and a narrow HTTP contract.
- **Contract drift between Node and Python** -> Mitigated by typed request/response schemas and contract tests that validate sample parser responses.
- **Slower import latency from an extra network hop** -> Mitigated by keeping the parser service close to the main app within the deployment network and limiting the HTTP payload to fetched HTML plus metadata.
- **Dependency maintenance burden shifting upstream rather than disappearing** -> Mitigated by a deliberate version pin, committed lockfile, and explicit upgrade workflow rather than custom site-specific parser maintenance in Norish.

## Migration Plan

1. Add the dedicated Python parser API, pinned dependency definitions, request/response schemas, and service/deployment wiring.
2. Add the Node client, adapter, and boolean rollback flag with the Python backend as the default.
3. Mark the legacy structured parser modules as deprecated and route them only through the rollback flag path.
4. Validate imports against fixture-based tests and a manual URL verification set before release.
5. Deploy the parser API and Node changes together across local, test, CI, and production environments.
6. If production issues appear, enable the rollback flag and redeploy or restart the app to restore the legacy parser path.

## Open Questions

- None currently.
