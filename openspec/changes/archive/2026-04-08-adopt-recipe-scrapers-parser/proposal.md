## Why

Norish currently maintains custom structured recipe parsing for URL imports, including JSON-LD and microdata extraction, while AI remains the fallback path. Replacing the structured parser layer with `recipe-scrapers` can reduce ongoing maintenance burden, broaden site support, and let the team focus on fetch/auth handling and DTO normalization instead of site-specific HTML parsing.

## What Changes

- Add a Norish-owned Python parser API application in the monorepo that wraps the third-party `recipe-scrapers` package behind a FastAPI interface.
- Place that parser API as a deployable app under `apps/parser-api`, while leaving the exact runtime topology flexible per environment.
- Keep HTML fetching, browser automation, and site-auth token handling in the existing Node import pipeline.
- Send fetched HTML plus the source URL to the parser service, persist the scraper's canonical URL when available, and normalize its response into Norish's `FullRecipeInsertDTO`.
- Keep existing AI-only controls intact so `forceAI` and global `alwaysUseAI` bypass structured parser backends entirely.
- Make the Python parser path the default for URL recipe imports.
- Treat a Python parse as usable only when it yields the required recipe fields Norish already needs: title, ingredients, and steps.
- Keep media downloading and Norish-managed media storage in the existing Node pipeline; the Python service only returns media metadata/URLs.
- If the Python parser fails and AI is disabled, fail the import immediately instead of falling through to another structured backend.
- Return structured parser failure codes from the Python service, including upstream unsupported-site and missing-schema outcomes, and only run AI fallback when the page still appears likely to contain a recipe.
- Retain the existing JSON-LD and microdata parser logic as a deprecated fallback behind an explicit boolean runtime flag for operational rollback.
- Pin `recipe-scrapers` to an explicit version and define an intentional upgrade workflow backed by regression coverage.
- Add deployment, runtime config, health, logging, and test coverage for the new parser API and fallback behavior.

## Capabilities

### New Capabilities

- `recipe-url-import`: URL recipe imports use a dedicated parser backend that accepts fetched HTML and URL context, supports a deprecated legacy fallback path, and preserves the existing downstream recipe creation flow.

### Modified Capabilities

None.

## Impact

- Affected code: `apps/parser-api`, `packages/api` parser flow and media adaptation path, `packages/queue` recipe import worker, server/runtime config, Docker/deployment assets, and import-related tests.
- New systems: a dedicated Norish parser API application in the monorepo, plus the external `recipe-scrapers` Python package as a pinned dependency.
- Operational impact: Norish local, test, CI, and production environments will need the parser API available for default URL imports, with a rollback flag to re-enable the legacy parser path if the new backend is inconsistent.
- Dependencies: Python runtime, `recipe-scrapers`, FastAPI, dependency lockfiles/tooling for the Python app, and any supporting HTTP client/serialization tooling needed between Node and Python.
