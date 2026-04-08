## 1. Python Parser API

- [x] 1.1 Create the dedicated Python parser API app under `apps/parser-api` that wraps the external `recipe-scrapers` package with pinned FastAPI and parser dependencies.
- [x] 1.2 Implement the request and response schemas for sending `url` plus fetched `html` and returning either a successful serialized scraper model with canonical URL and parser metadata or a machine-readable parser failure code such as `WebsiteNotImplementedError`, `NoSchemaFoundInWildMode`, or `RecipeSchemaNotFound`.
- [x] 1.3 Add the FastAPI endpoint, health check, and local run instructions for the parser API.
- [x] 1.4 Commit the parser application's dependency lockfile and document the exact upgrade workflow for updating the pinned `recipe-scrapers` version.

## 2. Node Import Integration

- [x] 2.1 Add a Node client for calling the parser API with timeouts, error handling, and structured logging.
- [x] 2.2 Implement the adapter that converts the serialized `recipe-scrapers` response into Norish's `FullRecipeInsertDTO`, only accepting results that produce a title, ingredients, and steps while preserving canonical URL fallback behavior, ordered steps, best-available images, embedded videos when available, and conservative category/tag mapping.
- [x] 2.3 Keep Node-owned media handling on the new parser path by downloading and storing parser-returned images and embedded recipe-page videos through the existing Norish media pipeline.
- [x] 2.4 Update the URL import parser flow so `forceAI` and global `alwaysUseAI` take precedence over structured parser selection, the Python backend is the default for non-video URLs when AI-only mode is off, the old page-likelihood gate is removed from that path, parser failures return structured failure reasons, and AI fallback only runs when AI is enabled and the fetched page still passes the recipe-likeliness gate.
- [x] 2.5 Add the explicit boolean legacy rollback flag with the Python backend remaining the default when the flag is off.

## 3. Legacy Parser Deprecation And Deployment

- [x] 3.1 Mark the existing JSON-LD and microdata parser path as deprecated and route it only through the legacy rollback flag.
- [x] 3.2 Add parser API configuration to env validation, server config loading, and any runtime wiring needed by the import pipeline.
- [x] 3.3 Update local/test/CI/deployment assets to run and reach the parser API from Norish without making a separate-container sidecar the required production shape.
- [x] 3.4 Document rollout and rollback steps for switching between the default Python parser and the legacy rollback flag.

## 4. Verification

- [x] 4.1 Add contract tests for the Node-to-Python request and response boundary, including success and structured parser failure codes such as `WebsiteNotImplementedError`, `NoSchemaFoundInWildMode`, and `RecipeSchemaNotFound`.
- [x] 4.2 Add URL import tests covering AI-only precedence (`forceAI` and `alwaysUseAI`), successful Python parsing, invalid parser output, parser failure with AI fallback when enabled and the page still appears recipe-like, parser failure hard failure when the page does not pass the recipe-likeliness gate, parser failure hard failure when AI is disabled, and explicit legacy rollback mode.
- [x] 4.3 Document representative manual URL spot checks for parser quality, canonical URL handling, and media parity before release and during future dependency upgrades.
- [x] 4.4 Validate and document the mapping from `recipe-scrapers` exceptions to parser failure codes and how the Node-side recipe-likeliness gate decides whether AI fallback is allowed.
- [x] 4.5 Add the parser dependency upgrade verification checklist covering contract tests, fixture-based regression coverage, and representative manual URL spot checks.
