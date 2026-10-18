---
sidebar_position: 6
title: Recipe parser
description: How URL imports load and read recipe pages.
---

# Recipe parser

A URL import opens the page in **Obscura**, a headless browser, which is the
`obscura` service in the [Quick start](../quick-start.mdx) compose. Norish then
reads the recipe from that page with
[recipe-scrapers](https://github.com/hhursev/recipe-scrapers). When that finds
nothing and [AI](./ai-provider.md) is set up, the AI reads the page instead.
Video links go through [video import](./ai-provider.md#video-import).

If Obscura can't load the page, the import fails. Norish itself starts without
Obscura, so the app remains available but parsing won't.

Obscura blocks trackers, and refuses loopback and private-network addresses, so
an import can't reach services inside your network. For sites that only show a
recipe when you are signed in, see
[Site authentication](./site-authentication.md).

## Settings

| Variable                        | Description                                                    | Default             |
| ------------------------------- | -------------------------------------------------------------- | ------------------- |
| `OBSCURA_ENDPOINT`              | Obscura CDP endpoint used to render pages                      | `ws://obscura:9222` |
| `OBSCURA_CDP_TOKEN`             | Token for Obscura, the same value as on the `obscura` service  | (empty)             |
| `OBSCURA_NAVIGATION_TIMEOUT_MS` | How long a URL import waits for the page to load, milliseconds | `45000`             |
| `PARSER_API_TIMEOUT_MS`         | Parser API timeout in milliseconds                             | `15000`             |

To run the browser elsewhere, point `OBSCURA_ENDPOINT` at it, for example
`ws://browser.internal:9222`. Keep it inside your own network, because anything
that can reach it can drive the browser.

Obscura only starts on a network address when its `OBSCURA_CDP_TOKEN` is at
least 32 characters, and Norish has to send the same token. Generate one with
`openssl rand -hex 32`.

The compose files pin an exact Obscura image, like `0.2.4-norish.1`. For a
rolling release, use `norishapp/obscura:latest` instead.

A page counts as loaded once its images and scripts have finished too. If slow
sites fail with a timeout, raise `OBSCURA_NAVIGATION_TIMEOUT_MS`.

## Content detection

Overrides for how Norish detects recipe content. Most servers don't need these.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
