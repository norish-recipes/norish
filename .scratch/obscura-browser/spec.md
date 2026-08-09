# Replace the Rendered-Page Browser with Obscura

Status: ready-for-agent

## Problem Statement

Norish depends on a separately deployed headless Chromium container to render pages for URL imports and the occasional rendered-page fallback used by video imports. The deployment currently pulls an unpinned third-party Chrome image, while the server uses an old Rebrowser-patched Playwright Core package. Operators therefore depend on two browser-specific third-party artifacts whose versions and behavior are not owned together by Norish.

The integration also duplicates responsibilities that belong to the browser. Norish discovers Chrome's debugger WebSocket through a Chrome-specific HTTP endpoint, rewrites its hostname after DNS resolution, fabricates a Windows Chrome fingerprint, invents referers, detects one particular Cloudflare challenge, and waits through several independent lifecycle and content heuristics. Those layers are difficult to reason about, can contradict one another, and make the import path more browser-specific than it needs to be.

The Chrome-specific deployment vocabulary has spread through server configuration, Docker Compose, development containers, CI configuration, the website, Quick Start examples, and operator documentation. Replacing only the container without removing those assumptions would leave Norish with the same complexity under a different service name.

## Solution

Replace the Chrome service with one Norish-owned, multi-architecture Obscura image built from a pinned upstream source revision. The image includes Obscura's full stealth feature and always starts its CDP server with stealth enabled. The service remains separate from the Norish application container and is the only rendered-page engine.

Replace Rebrowser's patched package with the official `playwright-core` package, aligned with the repository's Playwright Test version. Norish connects directly to the configured Obscura CDP endpoint and reduces rendered-page fetching to one narrow flow: obtain the shared connection, create an isolated context, inject only the requesting user's Site Auth Tokens, navigate once under one bounded deadline, return the rendered HTML, and close the context.

Obscura owns JavaScript execution, page settling, stealth, tracker blocking, and the generic browser fingerprint. Norish no longer manufactures browser headers or referers, probes Chrome's debugger metadata, rewrites endpoint hostnames, detects individual challenge vendors, or waits for recipe-shaped selectors. The existing structured and AI recipe extraction flow continues to consume the returned HTML without learning about Obscura.

Rename the operator setting from `CHROME_WS_ENDPOINT` to `OBSCURA_ENDPOINT`. This is an intentional breaking change with no compatibility alias. Update every current deployment and documentation surface, remove the old Chrome service and Rebrowser references completely, and document the required upgrade step. Obscura's private-network protection remains enabled; URL imports may not reach loopback, RFC1918, or link-local targets.

## User Stories

1. As a self-hosting operator, I want Norish to stop requiring a third-party Chromium container, so that the recipe-import browser is an artifact the Norish project controls.
2. As a self-hosting operator, I want the Obscura image built from a pinned upstream revision, so that rebuilding a Norish release cannot silently select different browser source.
3. As a self-hosting operator, I want immutable Obscura image tags, so that an ordinary container pull cannot change a running release unexpectedly.
4. As an x86-64 operator, I want a native Obscura image for my architecture, so that I do not need emulation to run URL imports.
5. As an ARM64 operator, I want a native Obscura image for my architecture, so that Norish remains practical on ARM servers and home-lab hardware.
6. As a security-conscious operator, I want the image built with Obscura's complete stealth support, so that runtime stealth includes its transport-level behavior rather than only partial fingerprint masking.
7. As a security-conscious operator, I want stealth enabled on every rendered-page request, so that Norish never silently downgrades to a more detectable mode.
8. As an operator, I want one browser service rather than separate plain and stealth services, so that the deployment remains easy to understand and maintain.
9. As an operator, I want Obscura to be the sole rendered-page engine, so that I do not have to provision Chrome as a hidden fallback.
10. As an operator, I want a failed Obscura request to fail through the existing import path, so that the server does not mask deployment problems by switching engines.
11. As an operator upgrading Norish, I want `OBSCURA_ENDPOINT` documented clearly, so that I can update my Compose or environment configuration before starting the new release.
12. As an operator upgrading Norish, I want the removal of `CHROME_WS_ENDPOINT` called out as a breaking change, so that an old environment file does not surprise me during the upgrade.
13. As an operator, I want the old Chrome variable removed rather than deprecated indefinitely, so that there is one authoritative browser setting.
14. As an operator, I want the default endpoint to address the shipped Obscura service, so that the standard Compose setup works without additional browser configuration.
15. As an operator using a custom deployment, I want to point `OBSCURA_ENDPOINT` at another reachable Obscura CDP server, so that the application and browser may be scheduled separately.
16. As a security-conscious operator, I want the production CDP service kept inside the deployment network, so that arbitrary clients cannot drive Norish's browser.
17. As a security-conscious operator, I want private-network targets blocked, so that an authenticated URL import cannot turn the browser into unrestricted access to loopback, LAN, or metadata services.
18. As an operator, I want no switch that globally disables Obscura's private-network protection, so that a casual configuration change cannot reopen that SSRF surface.
19. As a recipe importer, I want JavaScript-rendered recipe pages to continue producing Imported Recipe Data, so that changing browser engines does not change the purpose of URL import.
20. As a recipe importer, I want the page rendered before its HTML is parsed, so that recipe data inserted by page scripts remains available to the structured parser and AI fallback.
21. As a recipe importer, I want supported anti-bot pages approached through Obscura's stealth behavior, so that the browser has its best chance of reaching the recipe without Norish carrying vendor-specific evasions.
22. As a recipe importer, I want an import that still cannot reach or parse its source to report the normal import failure, so that failure remains truthful rather than pretending a fallback succeeded.
23. As a recipe importer, I want my stored cookie Site Auth Tokens applied to the isolated page context, so that authorized recipe sources remain importable.
24. As a recipe importer, I want my stored header Site Auth Tokens passed exactly as configured, so that header-authenticated sources remain importable.
25. As a recipe importer, I want my authentication state isolated from other imports, so that one person's Site Auth Tokens cannot leak into another browser context.
26. As a recipe importer, I want every browser context closed after its page is read or fails, so that repeated imports do not leak sessions or memory.
27. As a recipe importer, I want navigation bounded by one clear deadline, so that a broken page cannot keep an import job alive indefinitely.
28. As a recipe importer, I want ordinary structured parsing and AI fallback to receive the same rendered-HTML input contract, so that the browser migration does not rewrite recipe extraction policy.
29. As a recipe importer forcing AI extraction, I want the same rendered HTML supplied to AI as before, so that the browser migration does not change my selected extraction path.
30. As a video importer, I want existing consumers of rendered-page fetching to use the same Obscura seam, so that Instagram or similar fallbacks do not retain a hidden Chrome dependency.
31. As a maintainer, I want official Playwright Core instead of Rebrowser's patched fork, so that the runtime follows the supported upstream package.
32. As a maintainer, I want runtime Playwright Core aligned with Playwright Test, so that the repository does not carry avoidable duplicate Playwright generations.
33. As a maintainer, I want Obscura to own the generic browser fingerprint, so that headers, JavaScript surfaces, TLS behavior, and rendering do not contradict Norish-authored spoofing.
34. As a maintainer, I want Norish to stop sending fabricated Chrome client hints, so that an old hard-coded browser version cannot undermine Obscura's coherent identity.
35. As a maintainer, I want Norish to stop inventing Google or same-site referers, so that source requests reflect browser behavior rather than application randomness.
36. As a maintainer, I want the application to connect directly to `OBSCURA_ENDPOINT`, so that Chrome-only debugger discovery and DNS rewriting disappear.
37. As a maintainer, I want one navigation operation rather than stacked challenge and selector waits, so that the rendered-page deadline is understandable.
38. As a maintainer, I want Cloudflare-specific challenge code removed, so that the generic import pipeline does not encode one anti-bot vendor's markup.
39. As a maintainer, I want recipe-shaped selector waits removed from the fetching layer, so that determining whether HTML contains a recipe remains the parser's responsibility.
40. As a maintainer, I want a disconnected shared browser connection replaced on the next request, so that an Obscura restart does not require restarting the Norish application.
41. As a maintainer, I want concurrent imports to retain isolated contexts over the shared connection, so that simplifying the connection code does not serialize unrelated jobs unnecessarily.
42. As a maintainer, I want logs and errors to name Obscura rather than Chrome, so that operational diagnosis points to the service actually in use.
43. As a contributor, I want the local Compose stack to start Obscura automatically, so that URL-import development does not require a separate manual command.
44. As a contributor using the development container, I want it to start and address the same Obscura service as other development setups, so that its behavior does not drift.
45. As a contributor, I want the example and test Compose definitions to use the same service vocabulary and port convention, so that copying between environments does not resurrect Chrome assumptions.
46. As a documentation reader, I want Quick Start and parser configuration pages to describe Obscura accurately, so that I do not configure a service Norish no longer uses.
47. As a user reading release notes, I want this browser replacement explained in operator-facing language, so that I understand the upgrade action without knowing Playwright internals.
48. As a release maintainer, I want the Norish Obscura image published before an application release references it, so that the documented Compose stack never points at a missing artifact.
49. As a release maintainer, I want building the pinned Obscura image to be repeatable in release automation, so that an emergency rebuild does not depend on an undocumented workstation.
50. As a release maintainer, I want the old third-party Chrome image absent from every active deployment surface, so that the migration is complete rather than cosmetic.
51. As an agent implementing the migration, I want one narrow rendered-page boundary and no generic multi-browser abstraction, so that the code reflects the single-engine decision directly.
52. As an agent reviewing the migration, I want the new architecture recorded in an Imports ADR, so that the non-Chromium engine and always-stealth trade-off are not mistaken for accidental implementation details.
53. As an agent reviewing the migration, I want all old variable, service, package, error-message, and documentation references removed, so that stale compatibility paths cannot survive unnoticed.
54. As a maintainer, I want the existing web Playwright E2E runner left unchanged, so that a production scraping dependency does not become entangled with browser acceptance tooling.
55. As a maintainer, I want no live third-party recipe site in the automated gate, so that external rate limits and site changes cannot make Norish CI flaky.
56. As a maintainer, I want no dedicated Obscura compatibility suite, so that Norish trusts the engine's documented Playwright contract and tests only its own behavior.

## Implementation Decisions

### Browser artifact and deployment

- Norish owns and publishes a dedicated Obscura image rather than referencing an upstream Obscura or Chromium image directly from active Compose definitions.
- The image is built from an explicitly pinned upstream Obscura source revision. Release automation records that revision and produces Linux AMD64 and ARM64 variants under one immutable multi-architecture tag.
- The build enables Obscura's full stealth feature. Merely passing the runtime flag to a build without that feature is insufficient.
- The image starts one CDP server, binds only as required inside its container network, and always enables stealth.
- The application and Obscura remain separate services. Obscura is not installed into the Norish application image and is not launched as a child process by the Node server.
- Active deployment definitions replace the `chrome-headless` service with one consistently named `obscura` service. The old third-party Chrome image, Chrome flags, shared-memory tuning that exists only for Chromium, service dependencies, ports, and container names are removed.
- Production examples do not publish the CDP port publicly. A development-only host mapping may bind to loopback for local inspection.
- Obscura's private-network protection remains at its secure default. The service is never launched with `--allow-private-network` in production, development, tests, examples, or documentation.
- Obscura is the only rendered-page engine. There is no plain Obscura service, Chrome fallback, feature flag, engine registry, or per-site engine selection.
- Obscura upgrades are intentional changes to the pinned source revision and immutable image tag. Active Compose examples never use `latest` for the browser artifact.
- The image preserves upstream license and attribution requirements.

### Runtime browser boundary

- The server depends on the official `playwright-core` package. The Rebrowser alias and every Rebrowser package reference are removed from package manifests and the lockfile.
- Runtime Playwright Core uses the same major and minor version as the repository's Playwright Test dependency unless an explicit compatibility reason is documented.
- The application connects directly to `OBSCURA_ENDPOINT` through Playwright's CDP connection API. It does not call Chrome's `/json/version`, resolve or replace endpoint hostnames, or know the shape of a Chrome debugger URL.
- One healthy browser connection may be reused across imports. If it is absent or disconnected, the next caller establishes it from the configured endpoint.
- Every rendered-page fetch owns a fresh isolated browser context and page. Cleanup closes that context after success or failure without closing the shared Obscura service.
- The only request customization Norish applies is the current user's applicable Site Auth Tokens. Header tokens remain extra HTTP headers; cookie tokens remain cookies scoped to the target host and root path.
- Norish supplies no generic User-Agent, Chrome client hints, fetch metadata, language preference, cache directive, DNT value, referer, viewport fingerprint, or other anti-detection header. Obscura owns the default browser identity.
- Navigation happens once under one bounded deadline and waits only through the lifecycle Obscura exposes for that navigation. There is no second generic idle wait, challenge-specific wait, arbitrary sleep, or recipe-selector race.
- A successful fetch returns the rendered page HTML. Connection, context, navigation, or content failures are logged with Obscura terminology and produce the existing URL-import fetch failure; they do not invoke another engine or an undocumented HTTP client.
- The fetching boundary does not decide whether returned HTML contains a recipe. Structured parsing, recipe-likelihood detection, and AI extraction remain in the existing import pipeline.
- All current rendered-page consumers reuse this boundary. No consumer may retain a direct Chrome, Rebrowser, or second Playwright connection.
- Process shutdown continues to close the cached client connection safely, while ordinary per-import cleanup remains context-scoped.

### Configuration contract

- `OBSCURA_ENDPOINT` is the sole server configuration value for the rendered-page browser. Its shipped default addresses the standard `obscura` service on Obscura's CDP port.
- `CHROME_WS_ENDPOINT` is removed from environment validation, runtime configuration, build and task environment pass-through, CI configuration, examples, and docs.
- There is no compatibility alias, warning-only transition, dual-variable precedence rule, or automatic translation from the old setting.
- The setting name does not promise that its value is a raw browser WebSocket URL; it represents the endpoint format accepted by the official Playwright CDP connection method.
- Missing or unreachable Obscura remains an operational import failure rather than a server-startup blocker, preserving the existing ability to run Norish when URL import is not used.

### Documentation and architectural record

- The implementation updates the root environment example, README Quick Start, generated Quick Start snippet, website self-hosting example, current parser configuration page, development setup, active Docker examples, and development-container configuration.
- Frozen versioned documentation is not rewritten. The Target Version documentation and release notes carry the migration.
- The Target Version release notes include an operator-facing improvement entry and an Upgrade note that replaces `CHROME_WS_ENDPOINT` with `OBSCURA_ENDPOINT` and identifies the new service.
- The parser documentation explains that Obscura renders non-video URL imports before the structured parser and AI fallback inspect the HTML.
- No screenshot is required because the change has no new or changed user-interface surface.
- The implementation adds a globally numbered ADR in the Imports area and updates the ADR index. The ADR records the choice of a pinned Norish-owned Obscura sidecar, full always-on stealth, official Playwright Core, no engine fallback, simplified ownership boundary, and retained private-network protection.
- The root glossary is unchanged because Obscura, CDP, and stealth are implementation concepts rather than Norish product-domain language.

### Migration completeness

- Active source, configuration, deployment, CI, tests, logs, docs, and package metadata contain no remaining `chrome-headless`, `CHROME_WS_ENDPOINT`, `rebrowser-playwright`, Chrome-service error, or fabricated browser-fingerprint reference.
- References to Chromium that genuinely describe the existing Playwright E2E runner remain; this migration must not rename or remove unrelated browser acceptance tooling.
- Stale comments claiming a plain HTTP fallback are corrected. The URL import fetch path is Obscura-only and reports failure when Obscura produces no usable HTML.
- No schema, database, tRPC, queue payload, recipe, Site Auth Token, or user-interface contract changes are introduced.

## Testing Decisions

- Tests assert Norish-owned behavior rather than Obscura's internal implementation. They do not assert CDP command ordering, stealth fingerprints, tracker lists, TLS handshakes, or upstream browser conformance.
- The existing rendered-page fetch unit seam remains the primary focused seam. Its browser object stays mocked while tests prove Site Auth Token header injection, cookie scoping, isolated-context creation, returned HTML, cleanup after success, and cleanup after failure.
- Existing fetch tests are updated to prove that Norish no longer supplies default fingerprint headers or a fabricated referer. They continue to prove that user-supplied authentication headers are preserved exactly.
- The existing URL import-flow seam continues to mock rendered fetching and test observable extraction behavior: structured parsing, AI-only extraction, AI fallback, non-recipe failure, and video-path separation. The browser migration must not change those outcomes.
- Existing video processor tests continue to prove that consumers of rendered-page HTML retain their current fallback and extraction behavior.
- Existing configuration tests, type checking, and build validation cover the new `OBSCURA_ENDPOINT` contract and removal of the old variable. Tests should not preserve the old variable as an alias.
- Active Compose definitions are checked with Docker Compose configuration rendering or their existing equivalent so invalid service dependencies, commands, environment values, or ports are caught without navigating to the public internet.
- Release automation must successfully build the pinned multi-architecture, stealth-enabled Obscura image before publishing an application configuration that references its tag. This is artifact validation, not an Obscura behavior suite.
- No dedicated Obscura integration test, Playwright-to-Obscura smoke test, live recipe-site corpus, anti-bot detector, or new browser E2E project is added. The design explicitly trusts Obscura's documented Playwright-over-CDP support.
- The existing web E2E runner and its projects remain unchanged but still run as the repository's normal browser regression gate.
- Definition-of-done validation remains the repository gates: lint, unit/integration tests, i18n validation, production build, and the existing browser E2E command. Results are reported independently if an environmental blocker prevents a gate from running.
- Documentation validation runs in the standalone docs workspace: formatting and a production build must both pass so the renamed setting, links, and Upgrade note are valid.
- A good test observes an input/output or lifecycle contract that Norish owns. It must remain valid if Obscura changes its internal CDP or stealth implementation without changing the documented Playwright behavior Norish consumes.

## Out of Scope

- Supporting Chromium, Rebrowser, Puppeteer, a plain Obscura mode, or any second rendered-page engine after the cutover.
- Falling back from stealth to plain rendering, from Obscura to Chrome, or from rendered fetching to an undocumented HTTP client.
- Adding an engine-selection abstraction, per-site browser policy, operator engine toggle, or compatibility feature flag.
- Preserving `CHROME_WS_ENDPOINT` as an alias or running a deprecation period.
- Allowing URL imports to reach loopback, RFC1918, link-local, container-internal, or other private-network services.
- Adding proxy, residential-IP, fingerprint-profile, timezone, locale, worker-count, or tracker-blocklist configuration for Obscura.
- Proving or promising that Obscura bypasses every Cloudflare, DataDome, CAPTCHA, or anti-bot challenge.
- Maintaining a live-site acceptance corpus, bot-detection benchmark, or Obscura protocol-conformance suite.
- Changing structured recipe parsing, AI extraction, recipe-likelihood detection, video downloading, queue semantics, persistence, or Recipe Enrichment.
- Moving Obscura into the application container or replacing the CDP boundary with Obscura's CLI, MCP server, or Rust library.
- Changing the existing Playwright Test configuration, browser downloads, browser projects, or web E2E architecture.
- Updating frozen versioned documentation or adding user-interface screenshots for an operator-only infrastructure change.
- Implementing the migration as part of this specification task.

## Further Notes

- At the time this spec was written, Obscura documents Playwright support through CDP and full stealth as a combination of a stealth-enabled build and the runtime `--stealth` flag. Its upstream default Docker build does not by itself establish the full stealth build contract selected here; the Norish-owned image must do so explicitly.
- Obscura stealth owns both fingerprint behavior and tracker blocking. Norish deliberately accepts that trade-off in exchange for one coherent browser layer and does not add per-site exceptions.
- The current Rebrowser dependency and the former application-level stealth plugin show that anti-detection motivated earlier browser choices, but this migration removes all Norish-authored evasion behavior in favor of Obscura's single implementation.
- The browser engine changes, but Imported Recipe Data and downstream extraction semantics do not. A successful import is still determined by the existing parser and AI rules, not by whether navigation returned HTTP 200 or non-empty HTML.
- This `ready-for-agent` artifact specifies future work. It is not evidence that the Obscura image, runtime cutover, documentation, ADR, or validation gates have been implemented or passed.
