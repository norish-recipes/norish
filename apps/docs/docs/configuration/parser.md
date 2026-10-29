---
sidebar_position: 6
title: Recipe parser
description: How URL imports load and read recipe pages.
---

# Recipe parser

A URL import first fetches the page plainly. A page that already holds a
recipe in its HTML is read straight away. Any other page goes to the **page
renderers**, browsers that read pages a plain fetch cannot. Norish then reads
the recipe with [recipe-scrapers](https://github.com/hhursev/recipe-scrapers).
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
  commented-out services: uncomment one and switch it on. Norish fills in
  `http://flaresolverr:8191/v1`; for Byparr, change it to
  `http://byparr:8191/v1`. Each page it reads starts a new browser, which takes
  a few seconds.

Switching the Chromium browser or the solver on tests its endpoint, and **Test** tests
it again: Norish connects to the browser, and has the solver
read `https://example.com`.

Site authentication tokens go to Obscura and the Chromium browser, which keep
them to the token's site. The solver gets the page without them, so a page that
needs you signed in needs one of the browsers. See
[Site authentication](./site-authentication.md).

With all three off, Norish only fetches pages plainly. If no page renderer can
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
least 32 characters, and Norish has to send the same token. Generate one with
`openssl rand -hex 32`.

The compose files pin an exact Obscura image, like `0.2.5-norish.1`. For a
rolling release, use `norishapp/obscura:latest` instead.

A page counts as loaded once its images and scripts have finished too. If slow
sites fail with a timeout, raise the navigation timeout.

### Chromium browser

The example compose file has a commented-out `chromium` service. Its image,
`norishapp/chromium`, is Norish's build of
[fingerprint-chromium](https://github.com/adryfish/fingerprint-chromium), a
Chromium that gets a new browser fingerprint on every start. Both are BSD-3
licensed.

- It runs on amd64 only, because upstream builds Linux for x86_64 only.
- It needs `shm_size: 1gb`, as in the example. Docker's default 64 MB crashes it.
- Its endpoint is `http://chromium:9222`, filled in when you switch it on.

Any other Chromium with a CDP endpoint works too, including a hosted browser.
If the endpoint carries a token in its query string, like
`wss://browser.example/cdp?token=...`, Norish leaves the query string out of its
logs.

## Settings

These set up the page renderers at the first start. After that they live in
admin settings, and changing the variables does nothing.

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

Overrides for how Norish detects recipe content. Most servers don't need these.

| Variable              | Description                                     | Default |
| --------------------- | ----------------------------------------------- | ------- |
| `UNITS_JSON`          | Override the units dictionary                   | (empty) |
| `CONTENT_INDICATORS`  | Override recipe-content indicator configuration | (empty) |
| `CONTENT_INGREDIENTS` | Override ingredient-content configuration       | (empty) |
