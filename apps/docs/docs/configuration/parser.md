---
sidebar_position: 6
title: Recipe parser
description: How URL imports load and read recipe pages.
---

# Recipe parser

If a URL import fails, check the page renderers. Norish fetches the page
directly first, then tries the enabled renderers in order. [AI](./ai-provider.md)
can read pages the recipe scraper cannot parse. For video links, see
[Video import](./ai-provider.md#video-import).

## Page renderers

Open **Page renderers** in admin settings.

![The Page renderers card in admin settings](/img/screenshots/admin-page-renderers.png)

1. **Obscura** comes with the [Quick start](../quick-start.mdx) Compose file.
   Set the same `OBSCURA_CDP_TOKEN` in Norish and Obscura. Generate a token with
   `openssl rand -hex 32`.
2. **Chromium browser** takes a CDP endpoint. See [Chromium browser](#chromium-browser).
3. **FlareSolverr or Byparr** comes last. Enable one of the services in the
   example Compose file and set the endpoint to `http://flaresolverr:8191/v1`
   or `http://byparr:8191/v1`.

Use **Test** to check the Chromium or solver endpoint. Raise the renderer
timeout if slow pages time out. Imports use only the direct fetch when you
turn off all renderers.

Use Obscura or Chromium for pages that need
[site authentication](./site-authentication.md). Norish sends tokens to the
browser only for their site. Solvers receive no tokens.

Keep these services on a private network. Anyone who can reach their endpoints
can control the browser or use the solver.

Leave **Allow private addresses** off unless you need to import from a site on
your own network. Obscura always blocks private addresses. When you enable
the setting, Norish can use direct fetch, Chromium or the solver for those sites.

### Chromium browser

The example Compose file includes an optional Chromium service at
`http://chromium:9222`. It requires amd64 and `shm_size: 1gb`. You can also
use a hosted Chromium CDP endpoint. Norish omits query-string tokens from logs.

## Settings

These variables set the initial renderer configuration. After the first start,
make changes in admin settings.

| Variable                    | Description                                                   | Default             |
| --------------------------- | ------------------------------------------------------------- | ------------------- |
| `OBSCURA_ENDPOINT`          | Obscura CDP endpoint. Empty turns Obscura off                 | `ws://obscura:9222` |
| `OBSCURA_CDP_TOKEN`         | Token for Obscura, the same value as on the `obscura` service | (empty)             |
| `CHROMIUM_BROWSER_ENDPOINT` | Chromium browser CDP endpoint. Setting it turns it on         | (empty)             |
| `PAGE_SOLVER_ENABLED`       | Try FlareSolverr or Byparr after the browsers                 | `false`             |
| `PAGE_SOLVER_ENDPOINT`      | The solver's `/v1` endpoint                                   | (empty)             |
| `ALLOW_PRIVATE_ADDRESSES`   | Let imports reach private addresses                           | `false`             |
| `PAGE_RENDERER_TIMEOUT_MS`  | How long a page renderer is given to load a page, in ms       | `45000`             |

| Variable                | Description                        | Default |
| ----------------------- | ---------------------------------- | ------- |
| `PARSER_API_TIMEOUT_MS` | Parser API timeout in milliseconds | `15000` |

## Content detection

Use these variables to override recipe content detection.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
