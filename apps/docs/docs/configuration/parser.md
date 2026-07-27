---
sidebar_position: 6
title: Recipe parser
description: How Norish scrapes and parses structured recipes.
---

# Recipe parser

Norish imports structured recipes through a parser service. By default, non-video
URL imports go through the Python parser API first, scraping the page with a
headless Chrome instance.

## How it works

Structured imports use the [**recipe-scrapers**](https://github.com/hhursev/recipe-scrapers)
library (wrapped by [`apps/parser-api`](https://github.com/norish-recipes/Norish/tree/main/apps/parser-api)).
Page scraping uses headless Chrome at `CHROME_WS_ENDPOINT` — the `chrome-headless`
service in the [Quick start](../quick-start.mdx) compose.

## Settings

| Variable                | Description                                    | Default                     |
| ----------------------- | ---------------------------------------------- | --------------------------- |
| `CHROME_WS_ENDPOINT`    | Playwright CDP WebSocket endpoint for scraping | `ws://chrome-headless:3000` |
| `PARSER_API_TIMEOUT_MS` | Parser API timeout in milliseconds             | `15000`                     |

## Content detection

Advanced overrides for how recipe content is detected. Most instances never need
these.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
