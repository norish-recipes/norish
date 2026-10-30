# Page Renderers: Obscura and a FlareSolverr-compatible solver

Status: ready-for-agent

Decision record: `docs/adr/imports/0019-page-renderers-are-tried-in-a-fixed-order.md`. Glossary: **Page Renderer** in `CONTEXT.md`. Target Version: 0.26.0.

## Problem Statement

Norish reads some web pages that a plain fetch cannot, and Obscura is its only way to do that. URL imports, Store Visits and the Instagram caption fallback all rely on it. Cloudflare challenges Obscura on sites that it serves without a challenge to an honest plain request (#641), so those imports fail. Many self-hosters already run FlareSolverr or Byparr for their other services, but Norish cannot use them. Obscura is configured only through env vars, so an administrator cannot see or change rendering from admin settings. Every deployment also has to run the Obscura sidecar, even a deployment that only imports sites a plain fetch reads.

## Solution

An administrator connects one or both **Page Renderers** from a new **Page Renderers** card in admin settings. The two Page Renderers are Obscura and a FlareSolverr-compatible solver (FlareSolverr or Byparr). Every caller fetches plainly first. When the plain page is not enough, the caller tries Obscura, then the solver, in that fixed order, and moves on only when a renderer returns no HTML or returns a bot check. A request that carries Site Auth Tokens sends them only to Obscura. If Obscura is off or fails, the solver gets the page without the tokens. With both renderers off, Norish uses the plain fetch alone.

An **Allow private addresses** switch, off by default, decides whether a page fetch may reach a loopback, private or link-local address. When the switch is off, Norish refuses those targets before the plain fetch and before the solver. Obscura refuses them whatever the switch says.

Fresh installs ship with Obscura on, as today. FlareSolverr and Byparr appear as commented-out services in the Compose example. On an upgrade, the existing Obscura env vars seed the new setting, and admin settings own it from then on.

## User Stories

1. As an administrator, I want to switch on a FlareSolverr-compatible solver from admin settings, so that imports blocked by a Cloudflare challenge can still be read.
2. As an administrator, I want to enter the solver's endpoint URL, so that Norish can reach the FlareSolverr or Byparr instance I already run.
3. As an administrator, I want to switch Obscura off, so that I can run Norish without the Obscura sidecar.
4. As an administrator, I want to edit Obscura's endpoint and CDP token in admin settings, so that I don't have to redeploy to change them.
5. As an administrator, I want the CDP token stored encrypted and never shown back to me in full, so that it is handled like the AI API key.
6. As an administrator, I want one navigation timeout that applies to both renderers, so that I can tune slow sites in one place.
7. As an administrator, I want to switch both renderers off, so that a small instance that only imports plain pages needs no browser service.
8. As an administrator upgrading from 0.25, I want my existing `OBSCURA_ENDPOINT` and `OBSCURA_CDP_TOKEN` to carry over into the new setting, so that imports keep working after the upgrade.
9. As an administrator deploying with env vars only, I want the Page Renderer settings seeded from env on first boot, so that infrastructure-as-code deployments need no clicks.
10. As an administrator, I want a solver that is on but unreachable to count as a failed renderer, so that one dead service never stops the rest of the chain.
11. As an administrator, I want the log to say which Page Renderer answered a request, so that I can tell why two imports of the same site looked different.
12. As an administrator, I want the log to say when Site Auth Tokens were withheld from the solver, so that a login-only page that failed is explicable.
13. As an administrator, I want private addresses refused by default, so that the household members I let in cannot use imports to read my router, cloud metadata or other containers.
14. As an administrator with a recipe site on my LAN, I want to allow private addresses, so that I can import from it.
15. As an administrator, I want the Upgrade notes to tell me that private addresses are now refused by default, so that a LAN import that stops working has a documented cause.
16. As an administrator, I want the setting's description to say that Site Auth Tokens need Obscura, so that I know what I give up by running only a solver.
17. As a household member, I want a recipe from a site that challenges Obscura to import through the solver, so that I don't have to copy the recipe in by hand.
18. As a household member, I want a recipe page that holds a JSON-LD recipe to import without starting any browser, so that imports stay fast.
19. As a household member with a saved Instagram session, I want my Site Auth Tokens to go only to Obscura, so that a solver I can't scope never carries my session to another host.
20. As a household member, I want an import that every renderer fails to read to fail with the usual "couldn't read the page" error, so that I'm not shown an invented status.
21. As a household member, I want a link to a private address to fail with a clear reason when the administrator has not allowed private addresses, so that I know the refusal was deliberate and not a broken site.
22. As a household member using grocery prices, I want a shop page that challenges Obscura to be read through the solver, so that its products and prices still appear.
23. As a household member, I want a shop that both renderers fail to read to count as a shop Norish cannot read, as it does today, so that grocery prices degrade the same way they already do.
24. As a household member importing an Instagram image post with no caption from yt-dlp, I want the post rendered by whichever Page Renderer is on, so that the caption can still be found.
25. As a household member on an instance with both renderers off, I want imports to go through the plain fetch alone, so that pages a plain fetch can read still import.
26. As an operator reading the Compose example, I want FlareSolverr and Byparr shown as commented-out alternatives on port 8191, so that switching one on is an uncomment and an admin setting.
27. As an operator reading the docs, I want the parser configuration page to describe both Page Renderers, the fixed order, the token rule and the private-address switch, so that I can pick a setup.

## Implementation Decisions

- **The chain sits behind the existing rendered-page entry point.** URL import, Store Visits and the Instagram fallback keep calling the existing `renderPage` / `fetchRenderedPage` entry point, with the same signature: target URL, optional tokens, and the optional "is settled" reading. Callers do not learn which renderer answered. Inside, the entry point tries Obscura, if it is on, then the solver, if it is on. Each attempt is a named call in a fixed order. There is no registry and no engine interface (ADR-0019).
- **What counts as a failed render.** A renderer has failed when it returns empty HTML (unreachable, timed out or crashed) or the HTML is a bot check. There is one bot-check test, owned by the fetch layer and shared by every caller. It covers Cloudflare's challenge markup ("Just a moment…" / `cf-challenge`) and the small title-less stub that Store Visits detect today. The Store Visit module stops owning its own copy. "No recipe found" is never a render failure.
- **Tokens.** Only the Obscura attempt receives tokens, with its existing scoping. The solver attempt never receives tokens: no cookies and no headers. When tokens were present and the chain reaches the solver, it logs that they were withheld.
- **The solver client.** One FlareSolverr-compatible client posts `cmd: request.get` with the URL and a `maxTimeout` (the shared navigation timeout) to the configured `/v1` endpoint, and reads `solution.response`.
  - Both FlareSolverr and Byparr hard-code `solution.status` to 200, so the solver attempt always reports a null status, which means it never names a refusal.
  - The client does not pass the caller's "is settled" reading. The solver's answer is read once.
  - `status: "error"`, a non-2xx reply from the solver, a timeout or an unreachable endpoint all count as empty HTML.
  - FlareSolverr and Byparr are not distinguished anywhere.
- **The Obscura attempt.** It behaves as today: the cached connection, a per-fetch context, token injection, one navigation under the timeout, and the "is settled" polling. The difference is that the endpoint, token and timeout now come from the Page Renderer setting rather than from env at module load. When the configured endpoint or token changes, the cached connection is replaced on the next call.
- **The private-address guard.** One check in the fetch layer guards both the plain fetch and the solver attempt.
  - It resolves the target hostname and refuses the request when any resolved address is loopback, RFC1918, link-local, unique-local IPv6 or unspecified, unless **Allow private addresses** is on. It uses Node's DNS lookup and `net.BlockList`, with no new dependency.
  - The plain fetch applies it at every redirect hop, since it already follows redirects by hand.
  - Redirects inside the solver's browser, DNS rebinding and image downloads are not guarded. ADR-0019 records this.
  - Obscura's attempt does not run the check, because Obscura enforces its own deny.
  - A refused target returns empty HTML with a log line. The import failure names the refusal in words a household member understands.
- **New server-config key: Page Renderers.** It is one new `server_config` row, marked sensitive. Its value is:
  - `obscura: { enabled, endpoint, cdpToken? }`
  - `solver: { enabled, endpoint? }`
  - `allowPrivateAddresses: boolean`
  - `navigationTimeoutMs: number`

  It is read through a loader function in the shared-server config loader, alongside the AI and video config loaders.
- **Seeding from env.** The row is seeded at first boot from env, following the `AI_CONFIG` / `VIDEO_CONFIG` pattern:
  - Obscura is enabled when `OBSCURA_ENDPOINT` is set, which it is by default.
  - The solver gets new `PAGE_SOLVER_ENDPOINT` / `PAGE_SOLVER_ENABLED` vars, off by default.
  - `allowPrivateAddresses` comes from a new `ALLOW_PRIVATE_ADDRESSES` var, false by default.
  - `navigationTimeoutMs` comes from `OBSCURA_NAVIGATION_TIMEOUT_MS`, renamed to `PAGE_RENDERER_TIMEOUT_MS` as a clean break with an Upgrade note.

  Once the row exists, env changes do nothing. `OBSCURA_ENDPOINT` loses its "required" framing.
- **Admin API.** An admin tRPC procedure pair on the existing admin config router reads and saves the Page Renderers setting. Reads mask the CDP token the way the AI key is masked. A save with an unchanged masked token keeps the stored one.
- **Admin UI.** A **Page Renderers** SettingsCard in admin settings holds:
  - an Obscura switch, endpoint and CDP token;
  - a FlareSolverr/Byparr switch and endpoint;
  - an Allow private addresses switch;
  - the navigation timeout.

  It has one-line descriptions in sentence case, including "Site Auth Tokens need Obscura", a footer through ActionButtonGroup and no test-connection button. New i18n keys are added for every locale.
- **The Instagram fallback** renders through the same entry point. With both renderers off, it gets empty HTML and the import continues as when the caption holds no recipe.
- **Compose and env surfaces.**
  - The Compose example keeps the `obscura` service on, and adds commented-out `flaresolverr` and `byparr` services on 8191, each with the matching commented env line on the norish service.
  - `.env.example` gains the new vars.
  - The test Compose file is unchanged.
- **Docs and release.** These ship with the feature:
  - The 0.26.0 release notes get a feature line.
  - The Upgrade notes cover the setting moving to admin settings (seeded from env), the timeout var rename, and private addresses now being refused by default.
  - The apps/docs parser configuration page gets its Page Renderer section, a configuration page entry for the new env vars, and a screenshot of the card.
  - The source comments that say "Obscura is the only rendered-page engine" are rewritten.

## Testing Decisions

- **What a good test is.** Tests assert what a caller gets back (HTML, status, which tokens went where, what was refused) for a given setup of renderers and pages. They never assert which internal function ran. Fakes stand in at the edges of the process: the Obscura connection and the solver's HTTP endpoint.
- **Seams.**
  - **The rendered-page entry point** is the one seam for the chain. It covers:
    - the order Obscura then solver;
    - falling through on empty HTML and on a bot check;
    - no fall-through when Obscura returns a real page;
    - each renderer alone, and both off;
    - tokens reaching Obscura and never the solver;
    - the withheld-tokens log;
    - a null status from the solver;
    - a solver error reply, timeout or non-2xx counting as a failure;
    - the "is settled" reading reaching Obscura only.

    Prior art: `packages/api/__tests__/server/parser/fetch-rendered-page.test.ts` and `fetch-auth-tokens.test.ts`, which already fake Obscura's connection. They gain a faked solver endpoint and a mocked Page Renderer config.
  - **The plain fetch** covers the private-address guard: refused by default for literal private IPs and for hostnames that resolve to them, refused at a redirect hop that turns private, allowed when the switch is on, and public targets unaffected. Prior art: the plain-fetch cases in `fetch-auth-tokens.test.ts`.
  - **Seeding and the admin router.**
    - Seeding is covered at first boot, from env, including the upgrader case where only the Obscura vars are set.
    - The admin router covers the token masked on read, a masked token kept on save, and a non-admin refused.
    - Prior art: `packages/api/__tests__/startup/*-sync.test.ts` and `packages/trpc/__tests__/admin/ai-config.test.ts`.
  - **E2E for the card.** An administrator switches the solver on, enters an endpoint, saves, reloads and sees it kept, and the CDP token is never shown in full. Prior art: `apps/web/__tests__/e2e/ai/decision-model.e2e.ts`. The E2E harness runs no real Obscura or solver, so render behaviour stays in the unit seam.
- The existing caller tests, for Store Visits, the import flow and the Instagram processor, keep faking the entry point. Only the bot-check test moving out of the Store Visit module touches `store-fetch.test.ts`.

## Out of Scope

- Racing the renderers, an admin-chosen order, per-site renderer memory, and host-to-renderer lists. ADR-0019 rejects all of them.
- Sending cookies or headers to FlareSolverr or Byparr.
- FlareSolverr sessions, proxies, `waitInSeconds`, `request.post` or screenshots.
- A test-connection button or renderer health status in the UI.
- Guarding image downloads, or redirects inside the solver's browser, against private addresses.
- Changing Obscura's own private-network deny, stealth or image pinning.
- Running a real Obscura or solver in the E2E harness.
- The parked mobile app.

## Further Notes

- The FlareSolverr and Byparr facts were read from both repositories at HEAD on 2026-10-25 (FlareSolverr v3.5.2, Byparr v3.0.4):
  - Byparr drops `cookies`, and neither solver accepts headers.
  - Both hard-code `status: 200`.
  - Neither denies private targets or authenticates `/v1`.
  - Both launch a fresh browser per request, at about 6 s each.
  - Both default to port 8191.
- Store Visit refreshes fetch many pages. A solver costs a browser launch on every page that reaches it, which is why the solver comes after Obscura and is never raced.
