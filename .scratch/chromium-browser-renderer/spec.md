# Chromium browser: a third Page Renderer

Status: ready-for-agent

Decision record: `docs/adr/imports/0019-page-renderers-are-tried-in-a-fixed-order.md`, edited in place. Glossary: **Page Renderer** and **Site Auth Token** in `CONTEXT.md`. Builds on `.scratch/page-renderers/spec.md`. Target Version: 0.26.0.

## Problem Statement

Some recipe sites refuse every Page Renderer Norish has. Allerhande (ah.nl) sits behind Akamai, and on 2026-10-25 it answered the plain fetch with a 403 "Access Denied" page. Obscura got the same page with a status of 200. A FlareSolverr-compatible solver never gets a chance, because Akamai's block page has a `<title>`. The bot check reads that page as a real one, so the chain stops at Obscura and the import fails with no recipe.

Administrators who would run a stealthier browser have no way to give it to Norish. Only Obscura speaks CDP to Norish, and Obscura's slot is meant for Obscura.

The review of the current Page Renderer code also found that tokens can reach places they should not:

- A token saved with a bare-word domain such as `instagram` is sent to `instagram.evil.com`.
- Tokens go to a browser for an http target.
- A CDP token survives an endpoint change, so it is sent to the new host.

## Solution

An administrator switches on a third Page Renderer, the **Chromium browser**: any Chromium that exposes a CDP endpoint. The Page Renderers card holds it with an endpoint only. With it on, the chain is plain fetch, then Obscura, then the Chromium browser, then the solver. Each step is optional and skipped when it is off. A step is tried only when the one before returns no HTML or a bot check.

The bot check learns to read titled block pages and refusal statuses, so a blocked Obscura hands the page on.

Norish ships its own Chromium image, which repackages fingerprint-chromium (BSD-3) from a pinned release, the way the Obscura image repackages its release. It is amd64 only and commented out in the Compose example. On 2026-10-25 it read Allerhande's recipe pages, with their Recipe JSON-LD, where these were blocked:

- plain Debian Chromium;
- Steel;
- Karakeep's Chrome image (Google Chrome stable);
- Patchright driving those browsers.

Site Auth Tokens reach the Chromium browser as well as Obscura. The solver still never gets them. Cookies are kept to their domain by the browser. Headers are added only to https requests on the token's site, and this is checked at every redirect hop. A token's domain is always a full domain.

## User Stories

1. As a household member, I want to import an Allerhande recipe by its URL, so that the supermarket's recipes are not out of reach.
2. As a household member, I want an import of a page that a stealth browser can read to succeed without my knowing which renderer read it, so that importing stays one paste.
3. As an administrator, I want to switch on a Chromium browser from the Page Renderers card, so that pages Obscura cannot read get a second browser before the solver.
4. As an administrator, I want to enter the Chromium browser's CDP endpoint, so that Norish reaches the browser service I run.
5. As an administrator, I want the endpoint to accept a query string, so that a hosted browser that takes its token in the URL works without a separate token field.
6. As an administrator, I want a query string in the endpoint kept out of the logs, so that a token in the URL is not written to them.
7. As an administrator, I want to run the Chromium browser with Obscura off, so that I can run one browser service rather than two.
8. As an administrator, I want to run the Chromium browser with the solver off, so that every page in a Store Visit avoids a solver browser launch.
9. As an administrator, I want to switch the Chromium browser off and have the chain behave exactly as before, so that the change is opt-in.
10. As an administrator, I want the card to describe the Chromium browser in one line, as "Any Chromium with a CDP endpoint", so that I know what to point it at.
11. As an administrator deploying from env, I want `CHROMIUM_BROWSER_ENDPOINT` to seed the Chromium browser on first boot, so that infrastructure-as-code deployments need no clicks.
12. As an administrator, I want admin settings to own the Chromium browser after that first boot, so that a later env change never overwrites what I saved.
13. As an administrator upgrading from a 0.26 beta, I want my existing Page Renderers setting to keep parsing and gain the Chromium browser switched off, so that the upgrade never drops me back to env values.
14. As an administrator, I want a Norish-published Chromium image I can uncomment in Compose, so that I need not find and package a stealth browser myself.
15. As an administrator on an arm64 host, I want the docs to say plainly that the Chromium image is amd64 only, so that I don't spend an evening on an image that cannot run.
16. As an administrator, I want the Chromium image's release pinned and its tag never overwritten, so that a pull today gives the browser I tested yesterday.
17. As an administrator, I want a Chromium browser that cannot be reached to show up somewhere I look, so that I learn the service is down from more than household members' failed imports.
18. As an administrator, I want an unreachable Obscura reported the same way, so that a dead sidecar is visible rather than buried in a log.
19. As a household member, I want an import that fails because every renderer was unreachable to fail with the usual message, so that I'm not shown infrastructure details.
20. As an administrator, I want to clear the CDP token, so that I can stop sending one.
21. As an administrator, I want the CDP token dropped when I change Obscura's endpoint, so that the old token is never sent to the new host.
22. As a household member with a Site Auth Token, I want my imports through the Chromium browser to carry it, so that a signed-in site behind a bot check still imports.
23. As a household member, I want my header token sent only to https requests on its site, so that my session never reaches another host the page loads from.
24. As a household member, I want my header token left off a redirect that goes off its site, so that a link that bounces elsewhere cannot capture my session.
25. As a household member, I want my cookie token kept to its domain by the browser, so that it is never sent to another site.
26. As a household member, I want my tokens never sent to a browser for an http page, so that my session never crosses the network in the clear.
27. As a household member, I want my tokens never sent to the solver, so that a service that cannot keep them to their site never sees them.
28. As a household member saving a Site Auth Token, I want a bare word such as `instagram` refused with a message asking for the full domain, so that I save `instagram.com` and know which sites get the token.
29. As a household member, I want a token saved for `instagram.com` to also reach `www.instagram.com`, so that subdomains of my site keep working.
30. As a household member, I want a token never sent to `instagram.evil.com`, so that a look-alike link cannot take my session.
31. As a household member upgrading with an old bare-word token, I want it to stop matching rather than to guess a site, so that it never goes somewhere I didn't mean it to.
32. As an administrator upgrading, I want the Upgrade notes to say that bare-word tokens must be saved again with their full domain, so that I can tell my household.
33. As an administrator, I want a Chromium browser render whose main document redirects to a private address refused, so that a public link cannot read my internal services through the stealth browser.
34. As an administrator with Allow private addresses on, I want the Chromium browser to reach my LAN recipe site, so that the switch means the same thing for every renderer that honours it.
35. As an administrator, I want CGNAT and Tailscale addresses (100.64.0.0/10) refused like other private addresses, so that my tailnet is not reachable from a pasted link.
36. As an administrator, I want benchmark, multicast, reserved and NAT64 ranges refused too, so that the private-address list has no gaps.
37. As a household member, I want a page that Obscura gets as an Akamai "Access Denied" page passed on to the next renderer, so that my import does not fail at the first block.
38. As a household member, I want a page titled "Attention Required!" or "403 Forbidden" read as a bot check, so that other block pages hand the import on too.
39. As a household member, I want a renderer's 401, 403 or 429 read as a bot check, so that a refusal with any page behind it hands the import on.
40. As a household member, I want Cloudflare's 403-then-200 handoff still read as the real page, so that sites that pass Cloudflare keep importing.
41. As a household member, I want an import to give up within a bounded time even when every renderer is slow, so that a stuck import doesn't hang for minutes.
42. As an administrator, I want each renderer attempt to keep to the navigation timeout, connection included, so that the timeout I set is the one that applies.
43. As an administrator running both Obscura and a Chromium browser, I want concurrent imports to keep their own connections to each, so that one renderer's import never closes the other's browser mid-render.
44. As an administrator, I want a setting change to replace only that renderer's connection, so that editing one renderer does not interrupt imports in the other.
45. As a household member using Store Visits, I want refreshes to read prices through the Chromium browser when Obscura is blocked, so that a blocked store still refreshes.
46. As a household member, I want Store Visits' wait for a page to settle to apply in the Chromium browser too, so that its prices are read once they have loaded.
47. As a household member, I want the Instagram caption fallback to use the Chromium browser when it is the renderer that is on, so that captions still import.
48. As an administrator, I want ADR-0019 to record the three renderers, the token rule and the private-address limits, so that the next contributor knows why the chain looks like this.
49. As an administrator reading the docs, I want the Page Renderer page to show the Chromium image, its licence, its amd64 limit and the CDP endpoint format, so that I can set it up from the docs alone.
50. As an administrator reading the 0.26.0 release notes, I want one line for the Chromium browser and one for the token-domain change, so that I see what changed in plain words.

## Implementation Decisions

### The chain

- **The chain stays behind the existing rendered-page entry point,** with the same signature. Callers still do not learn which renderer answered. The entry point makes three named calls in a fixed order: Obscura, the Chromium browser, the solver. Each call is skipped when its renderer is off.
  - There is still no registry and no engine interface. The renderers differ in their guards (tokens, the private-address check, status), so a registry would need a capability flag per entry, while the part they share is covered by one function.
- **The private-address check runs once per render,** before the first renderer that honours it, and its answer is reused for the Chromium browser and the solver. Obscura keeps its own deny and does not run the check.
- **The answered-renderer log** names `obscura`, `chromium` or `solver`.

### The bot check

- It is still one test, owned by the fetch layer. It now also counts as a bot check:
  - a page under the existing stub size whose title is "Access Denied", "Attention Required!" or "403 Forbidden";
  - a rendered page whose main-document status is 401, 403 or 429.
- The status is the main frame's last navigation, so Cloudflare's 403-then-200 handoff still reads as the real page.
- The plain fetch is unchanged: it already treats a non-2xx answer as no HTML.

### One browser render for both CDP renderers

- **Obscura's render becomes one browser render function** that both CDP renderers call. It takes:
  - the renderer's name;
  - the endpoint and an optional CDP token;
  - the navigation timeout;
  - the tokens;
  - the "is settled" reading;
  - a token-setting step, passed as a plain function argument.
- Obscura passes its existing step: scoped headers through its fork's `scopeDomain`, and cookies written from the target's origin. The Chromium browser passes the step described under Tokens.
- **One deadline per attempt.** The connection, any preliminary navigation and the main navigation share the navigation timeout. The settle wait keeps its own deadline. The comment claiming "one deadline" becomes true.
- **Connection errors are reported.** A renderer that cannot be reached still counts as no HTML for the chain. It is also logged at error level with the renderer's name, and with the endpoint without its query string. The admin-facing "not reachable" wording reaches that log line rather than being swallowed. Household members see the usual fetch failure.

### Connections

- **The connection module stops being Obscura's.** It keeps one cached connection, and one connection attempt in flight, per renderer name, keyed by endpoint and token.
- A key change replaces only that renderer's connection. Shutdown closes them all.
- A connection that resolves after a newer attempt is closed, never cached. Today's "an older connection can win" race is gone.
- Obscura's names leave the shared path: function names, log text and error strings. Obscura-specific wording stays only in Obscura's token-setting step.

### Tokens

- **Obscura:** unchanged, apart from the http rule below.
- **The Chromium browser:**
  - **Headers.** The page's CDP session enables `Fetch` interception, with request patterns limited to `https://<token domain>/*` and `https://*.<token domain>/*`. For each paused request, it continues with the original headers plus the header tokens whose domain the request's host is on.
  - Chromium pauses every redirect hop as its own request, and a hop outside the patterns is not paused, so a redirect off the site carries no header.
  - Playwright's `route` must not be used here. Its header overrides carry over to redirects, and in testing a header leaked from httpbin.org to postman-echo.com.
  - **Cookies.** Set with the browser context's `addCookies`, for the token's domain, `secure`, before the navigation. Stock Chromium honours cookies set over CDP, unlike Obscura, so the robots.txt pre-navigation is not used on this path.
- **The solver:** never gets tokens. The withheld-tokens log stays.
- **http targets:** no tokens are sent to any browser for a target that is not https. This matches the plain fetch, which already sends tokens only to https hops.
- **Domains.** A Site Auth Token's domain must contain a dot. Saving a bare word is refused with a validation message. The matching function drops its bare-word branch, so an existing bare-word token matches nothing. There is no migration and no compatibility code, and the Upgrade notes tell users to save such tokens again.
- A full domain matches that host and its subdomains, the existing rule the plain fetch and Obscura already use.

### Private addresses

- The deny list gains:
  - 100.64.0.0/10
  - 198.18.0.0/15
  - 224.0.0.0/4
  - 240.0.0.0/4
  - 64:ff9b::/96
- In the Chromium browser, a second `Fetch` pattern pauses document requests at the request stage. Each main-document hop is resolved through the same guard, and a refused hop fails the request, so the render returns no HTML.
- This runs only when Allow private addresses is off.
- Subresource requests, such as images and XHR, are not checked. ADR-0019 records that limit.

### Settings

- **The Page Renderers setting gains `chromium: { enabled, endpoint }`,** with a schema default of `{ enabled: false, endpoint: "" }`. The existing backfill then fills it into stored rows, and a stored 0.26 beta row still parses.
- The same "endpoint required when enabled" refinement applies as for Obscura.
- `CHROMIUM_BROWSER_ENDPOINT` seeds it on first boot, and setting it enables the renderer. After that first boot, admin settings own it.
- The endpoint is not a sensitive field. A secret belongs in the query string at the operator's own risk, and the query string is kept out of the logs.
- **The CDP token can be cleared.** An empty token on save clears it, and a changed Obscura endpoint without a newly entered token drops the stored one. The masked-unchanged rule applies only when the endpoint is unchanged.
- **The admin API** is the existing Page Renderers read and save pair. Reads carry the Chromium browser setting, and the save validates it.
- **The admin UI** is the existing Page Renderers card. It gains:
  - a "Chromium browser" switch, described as "Any Chromium with a CDP endpoint";
  - its endpoint field.

  The token description changes from "Site Auth Tokens need Obscura" to "the solver never receives Site Auth Tokens", in words to be settled at implementation. New i18n keys are added for every locale.

### The Chromium image

- A new `docker/chromium` directory mirrors `docker/obscura`. It has:
  - a Dockerfile that repackages the pinned fingerprint-chromium Linux x86_64 release archive on Debian slim;
  - a `pin.env` that records the release and the image tag together;
  - a README of a few lines.
- The container runs:
  - new headless mode;
  - a per-start random `--fingerprint` seed;
  - a non-root user;
  - its own profile directory;
  - socat forwarding the DevTools port, because Chromium binds it to localhost.
- It is published as `norishapp/chromium`, amd64 only, by a publish workflow modelled on the Obscura image workflow. The workflow refuses to overwrite a tag.
- **Compose** gains a commented-out `chromium` service with enough shared memory (an `shm_size`), next to the solver alternatives, and the matching commented env line on the norish service.
- Obscura stays on by default.

### Docs and release

- ADR-0019 is edited in place. Page Renderers have not shipped, so no second ADR is written. The edits:
  - the title and decision cover three renderers, and say the solver never gets tokens;
  - "two named calls" becomes three;
  - Camoufox is recorded as a considered option, rejected because it speaks Playwright's own protocol with a client and server version lockstep, and ships no upstream runtime image;
  - CloakBrowser and Fortress are recorded as rejected because their binaries are licence-gated;
  - the Chromium browser's private-address limits are written down.
- The 0.26.0 release notes get a line for the Chromium browser and one for the token-domain change.
- The Upgrade notes cover bare-word tokens and the new env var.
- The apps/docs Page Renderer section covers the Chromium browser, the image, its licence, its amd64 limit and the endpoint format.
- `.env.example` and the configuration page gain `CHROMIUM_BROWSER_ENDPOINT`.

### Commit order

Prerequisites and fixes land first, each as its own commit in the same PR, each with a failing test first:

1. the bot check reads titled block pages and refusal statuses;
2. token domains must be full domains;
3. no tokens to a browser for http;
4. the private-address ranges;
5. one deadline per attempt;
6. reachability is reported;
7. the CDP token can be cleared and is dropped on an endpoint change;
8. the connection race;
9. a connection per renderer, with the generic naming.

The Chromium browser renderer, the image, and the docs follow.

## Testing Decisions

- **What a good test is.** A test asserts what a caller gets back for a given setup of renderers and pages: the HTML, the status, which tokens reached which host, and what was refused. It never asserts which internal function ran. Fakes stand in only at the edges of the process: the CDP connections and the solver's HTTP endpoint. Every fix gets a test that fails before the fix.
- **Seam 1: the rendered-page entry point,** the main seam. Prior art: `fetch-rendered-page.test.ts`, `fetch-render-chain.test.ts`, `fetch-auth-tokens.test.ts`, `fetch-private-addresses.test.ts`, `bot-check.test.ts`, `fetch-obscura-connection.test.ts` and `obscura-connection.test.ts`, which already fake the Obscura connection and the solver. It covers:
  - the three-renderer order, each renderer alone, and fall-through on empty HTML and on a bot check;
  - Akamai's titled block page, a 401, 403 or 429, and Cloudflare's 403-then-200 still passing;
  - the Chromium browser's header tokens continued only on hops to the token's https site, and its cookies set through `addCookies`;
  - no tokens to any browser for http, and none to the solver;
  - a refused main-document hop to a private address, and the switch allowing it;
  - one deadline across the connection and the navigations;
  - an unreachable renderer logged at error level, with the endpoint's query string left out;
  - one connection per renderer, with no thrashing across concurrent imports and no stale connection cached.
- **Seam 2: Site Auth Token matching and save.** Prior art: `packages/shared/__tests__/lib/site-auth-tokens.test.ts` and the token save procedure's tests. It covers:
  - a bare word refused on save;
  - an old bare-word token matching nothing;
  - `instagram.com` matching `www.instagram.com`, and not `instagram.evil.com`.
- **Seam 3: the Page Renderers admin router and seeding.** Prior art: `packages/trpc/__tests__/admin/page-renderers.test.ts` and the startup seed tests. It covers:
  - the Chromium browser setting saved and read back;
  - the setting seeded from `CHROMIUM_BROWSER_ENDPOINT`;
  - a stored row without it backfilled and still parsing;
  - the CDP token cleared, and dropped on an endpoint change;
  - a non-admin refused.
- **Seam 4: one E2E against a real browser,** in `page-renderers.e2e.ts`. The E2E runner's own Chromium is started with a DevTools port and set as the Chromium browser's endpoint, with Obscura off and Allow private addresses on. A fixture page is served on two distinct hostnames, and an import carries a header token for the first. It asserts:
  - the import succeeds;
  - the header arrived at the first hostname;
  - an off-site redirect to the second hostname did not carry it.

  This is the only seam that proves the per-hop interception in a real Chromium. The card's E2E gains the Chromium switch and endpoint, saved and kept across a reload.
- **The callers' tests** (Store Visits, the import flow, Instagram) keep faking the entry point and need no change, beyond the swallowed-error cases that become reachable or are removed.
- **The image has no CI test,** the same as Obscura's image. Mike tests it by hand before the release. That test should cover:
  - an Allerhande recipe import;
  - an import from a site that needs a cookie token and one that needs a header token;
  - a public URL that redirects to a private address, refused;
  - the container restarting while imports run.

## Out of Scope

- Camoufox, and any Firefox renderer.
- Shipping CloakBrowser, Fortress or Google Chrome. An administrator may still point the Chromium browser at any of them.
- An arm64 Chromium image.
- A separate token field for the Chromium browser, or encrypting its endpoint.
- Checking the Chromium browser's subresource requests against private addresses, and DNS rebinding inside it.
- Proxies, fingerprint pinning or headed mode (Xvfb) in the shipped image.
- An admin-orderable chain, racing, and per-host renderer memory, which ADR-0019 rejects.
- A renderer health status or a test-connection button in the UI.
- Patchright, or any change to the Playwright client.
- The parked mobile app.

## Further Notes

Measured on 2026-10-25 from Mike's connection, against Allerhande recipe pages:

| Setup | Result |
|---|---|
| Plain fetch | 403 "Access Denied" (Akamai) |
| Obscura 0.2.x | 200 "Access Denied", 141 bytes |
| Debian Chromium 156, headless (also with a normal user agent) | 403 |
| Steel | 403; it also calls ipinfo.io on every start |
| Karakeep's Chrome image, arm64 Chromium and amd64 Google Chrome 156 | 403 |
| Patchright 1.64.2 driving those browsers or Obscura | Blocked, the same as without it |
| CloakBrowser free build (Chromium 146) | Read 3 of 3 pages, but its binary is licence-gated and not redistributable |
| fingerprint-chromium 150.0.7871.186, under amd64 emulation | Read 2 of 2 pages, with Recipe JSON-LD, in about 8 s |

- fingerprint-chromium is BSD-3 and based on ungoogled-chromium. Its patches are published about a month after each release, and it publishes Linux x86_64 only.
- Its tests crashed with Docker's default 64 MB of shared memory, which is why the Compose service sets `shm_size`.
- Header interception was verified against a real Chromium. With Playwright's `route`, the header followed a redirect from httpbin.org to postman-echo.com. With CDP `Fetch` patterns limited to the token's host, the redirect target got nothing, and the token's own host still got the header.
- Obscura ignores route-based header injection, which is why its fork carries `scopeDomain` and keeps its own token-setting step.
