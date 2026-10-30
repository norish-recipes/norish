---
sidebar_position: 6
title: Recipe parser
description: How URL imports load and read recipe pages.
---

# Recipe parser

URL imports first fetch the page directly. If its HTML contains a recipe,
extraction starts immediately. Other pages go to the **page renderers**, which
load content that a direct fetch cannot read. Recipes are extracted with [recipe-scrapers](https://github.com/hhursev/recipe-scrapers).
When that finds nothing and [AI](./ai-provider.md) is set up, the AI reads the
page instead. Video links go through
[video import](./ai-provider.md#video-import).

## Page renderers

Set them up under **Settings => Admin => Page renderers**.

![The Page renderers card in admin settings](/img/screenshots/admin-page-renderers.png)

- **Obscura** is the headless browser in the [Quick start](../quick-start.mdx)
  compose, the `obscura` service. It is tried first.
- **Chromium browser** is any Chromium with a CDP endpoint. It is tried when
  Obscura gets no page or a bot check, like the "Access Denied" page Akamai
  shows on Allerhande. See [Chromium browser](#chromium-browser).
- **FlareSolverr or Byparr** is tried when the browsers get no page or a bot
  check, like a Cloudflare challenge. The example compose file has both as
  commented-out services: uncomment one and switch it on. The default endpoint is
  `http://flaresolverr:8191/v1`; for Byparr, change it to
  `http://byparr:8191/v1`. Each page it reads starts a new browser, which takes
  a few seconds.

Enabling the Chromium browser or solver tests its endpoint. **Test** repeats
the check: a connection to the browser, or a request through the solver to
`https://example.com`.

Obscura and Chromium receive site authentication tokens only for the token's
site. The solver receives none, so pages that require sign-in need one of the
browsers. See
[Site authentication](./site-authentication.md).

With all three off, imports use only the direct fetch. If no page renderer can
read a page, the import fails.

**Allow private addresses** is off by default, so imports and shop pages can't
reach loopback, private-network, Tailscale or link-local addresses, like your
router or other containers. Turn it on to import from a recipe site on your own network.
Obscura refuses these addresses either way, so such a page is read by the plain
fetch, the Chromium browser or the solver. With the switch off, the Chromium
browser also refuses a page that redirects to such an address.

Keep these services inside your own network, without a host port: anything
that can reach Obscura or the Chromium browser can drive it, and the solvers
take no password.

Obscura only starts on a network address when its `OBSCURA_CDP_TOKEN` is at
least 32 characters, and the app must send the same token. Generate one with
`openssl rand -hex 32`.

The compose files pin an exact Obscura image, like `0.2.5-norish.1`. For a
rolling release, use `norishapp/obscura:latest` instead.

Page loading waits for images and scripts too. Raise the navigation timeout
if slow sites time out.

### Chromium browser

The example compose file includes a commented-out `chromium` service using
`norishapp/chromium`, a build of
[fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium) with a
new browser fingerprint on every start. Both are BSD-3
licensed.

- It runs on amd64 only, because upstream builds Linux for x86_64 only.
- It needs `shm_size: 1gb`, as in the example. Docker's default 64 MB crashes it.
- Its endpoint is `http://chromium:9222`, filled in when you switch it on.

Any other Chromium with a CDP endpoint works too, including a hosted browser.
If the endpoint carries a token in its query string, like
`wss://browser.example/cdp?token=...`, the query string is omitted from
logs.

## Settings

These variables seed the page renderers at first start. After that, change
them in admin settings; editing the variables has no effect.

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

Recipe-content detection overrides. Most servers don't need these.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
