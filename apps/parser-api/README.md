# Parser API

`apps/parser-api` is the Norish-owned FastAPI wrapper around the pinned `recipe-scrapers` dependency.

## Local Run

```bash
pnpm install
pnpm --filter @norish/parser-api dev
```

`apps/parser-api` requires Python `3.14.x`.

`apps/parser-api` uses a standard `uv` project layout: dependency metadata stays in `pyproject.toml`, the resolved lockfile lives in `uv.lock`, and the local environment is `.venv`.

`pnpm install` runs `uv sync --locked` in `apps/parser-api` to create `.venv` from `uv.lock`.

The custom Norish web server starts this parser automatically from `.venv/bin/python` on the fixed internal address `http://127.0.0.1:8001` when no parser is already listening there.

If you need to re-run the parser bootstrap manually, use:

```bash
pnpm --filter @norish/parser-api install:deps
```

The parser app exposes:

- `GET /health`
- `POST /parse`

For local non-Docker development, `pnpm run dev` starts the parser automatically through the web server. If you want to run the parser separately for debugging, start this workspace manually and keep it reachable at `http://127.0.0.1:8001`.

The production Docker image runs only the custom Node server process, and that server starts and supervises the embedded parser at `http://127.0.0.1:8001`.

## Request Contract

```json
{
  "url": "https://example.com/recipe",
  "html": "<!doctype html>..."
}
```

## Success Response

The success payload returns the serialized `recipe-scrapers` model under `recipe`, plus Norish metadata:

- `canonicalUrl`: scraper canonical URL when available
- `parser`: selected scraper, host, mode, and pinned version metadata
- `media.images`: ordered remote image candidates
- `media.videos`: embedded recipe-page `VideoObject` metadata

## Failure Codes

The API preserves upstream parser outcomes as machine-readable codes when possible:

| Code                         | Meaning                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `WebsiteNotImplementedError` | The site is unsupported by a dedicated scraper and wild mode did not run yet.    |
| `NoSchemaFoundInWildMode`    | Wild-mode fallback ran but the fetched HTML did not expose usable recipe schema. |
| `RecipeSchemaNotFound`       | A supported scraper ran but no usable recipe schema was found.                   |
| `ParserError`                | Any other parser exception or transport-safe fallback.                           |

The app first attempts the site-specific scraper. If that fails with `WebsiteNotImplementedError`, it retries with `wild_mode=True` to widen site coverage before returning a failure.

## Upgrade Workflow

1. Update the pinned versions in `apps/parser-api/pyproject.toml`.
2. Regenerate `apps/parser-api/uv.lock` with `uv lock`.
3. Re-sync the local environment with `uv sync --locked`.
4. Run the parser contract tests and URL import regression tests.
5. Re-run representative manual URL spot checks for parser quality, canonical URL handling, and media parity before merging.
