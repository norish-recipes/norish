---
sidebar_position: 6
title: Recipe parser
description: How Norish scrapes and parses structured recipes.
---

# Recipe parser

Norish imports structured recipes through a parser service. By default, non-video
URL imports are rendered in a browser first, then handed to the Python parser API.

## How it works

Plenty of recipe sites build their page with JavaScript, so the recipe simply is
not in the HTML the server first receives. Every non-video URL import is
therefore loaded in **Obscura** — the `obscura` service in the
[Quick start](../quick-start.mdx) compose — and it is that rendered HTML which
the structured parser, and the AI fallback behind it, read.

Structured imports use the [**recipe-scrapers**](https://github.com/hhursev/recipe-scrapers)
library (wrapped by [`apps/parser-api`](https://github.com/norish-recipes/Norish/tree/main/apps/parser-api)).
Whether the result is a recipe stays the parser's decision: Obscura returns a
page, nothing more. If Obscura cannot reach or render the page, the import fails
— there is no second browser and no plain-HTTP fallback behind it.

Obscura is a stealth browser: it presents one coherent browser identity and
blocks tracker and fingerprinting domains, which is what gives an import its
best chance on sites that screen automated traffic. Norish adds nothing to that
beyond the [site authentication tokens](./site-authentication.md) you have saved
for a source, and Obscura refuses to fetch loopback, private-network, and
link-local addresses, so an import cannot be pointed at services inside your
network.

## Settings

| Variable                | Description                               | Default             |
| ----------------------- | ----------------------------------------- | ------------------- |
| `OBSCURA_ENDPOINT`      | Obscura CDP endpoint used to render pages | `ws://obscura:9222` |
| `PARSER_API_TIMEOUT_MS` | Parser API timeout in milliseconds        | `15000`             |

The default addresses the `obscura` service shipped in the Quick start compose.
Point `OBSCURA_ENDPOINT` at any reachable Obscura CDP server if you would rather
run the browser elsewhere — the value is whatever that server answers on, for
example `ws://browser.internal:9222`. Keep it inside your own network: anything
that can reach it can drive the browser.

Norish starts fine without a reachable Obscura; URL imports are what fail, and
they say so.

## Content detection

Advanced overrides for how recipe content is detected. Most instances never need
these.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
