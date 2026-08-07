# Consolidate the Web E2E Harness

Status: ready-for-agent

## Problem Statement

Norish's web end-to-end tests have grown into two parallel harnesses. Offline scenarios and AI-backed scenarios each own their own Playwright configuration, global setup, environment assembly, production-server lifecycle, Testcontainers provisioning, authentication bootstrap, result directory, package command, and CI step. The two suites exercise genuinely different behavior, but most of their infrastructure implementation is copied. A lifecycle change therefore has to be made twice and can drift even though both suites run the same production build against PostgreSQL and Redis.

The current directory structure also makes the test architecture harder to discover. Ordinary web tests live under the workspace test tree, while browser scenarios live in two separate top-level directories and the fake AI provider's focused test is nested inside one of those directories. The existing “one E2E command” does not represent one runner interface; it builds once and then chains two unrelated Playwright invocations.

The AI harness has accumulated a second kind of conflation. One large support module mixes infrastructure lifecycle, authentication, fake-provider control, browser actions, configuration changes, and direct probes for Recipe Enrichment, Recipe Provenance, Prompts, categories, and Step Ingredients. Individual AI spec files still repeat production-stack startup, sign-in, browser-context creation, and teardown. Several AI scenarios also depend on browser state or recipes created by an earlier test, making focused execution and failure diagnosis less trustworthy.

Documentation screenshot capture is mixed into the browser-testing structure even though it is not an acceptance gate. One dedicated Playwright capture suite exists beside AI scenarios, and an Offline acceptance scenario writes a tracked documentation image as a side effect. This makes “run the tests” and “regenerate documentation assets” overlap without either purpose benefiting.

## Solution

Give web browser testing one conventional home, one Playwright configuration, one command, and one CI gate. The configuration defines two named projects, `offline` and `ai`, which run sequentially and provision isolated runtime state.

Use Playwright's standard fixture mechanism rather than inventing a profile framework. Two small project-specific fixture modules reuse one shared stack implementation:

- The Offline fixture owns a persistent browser profile and the controls needed to make the production backend Live, stopped, or deliberately unresponsive. Its stateful serial journey remains explicit because the Offline Cache, service worker, Outbox, identity changes, and Recovery across transitions are the behavior under test.
- The AI fixture owns one production stack per Playwright worker, resets the deterministic external-model adapter for every test, and supplies an authenticated fresh browser page through normal Playwright behavior. AI tests become independently runnable. A small exceptional control remains available to scenarios that intentionally restart the production process to verify Prompt loading across a deployment restart.

The shared harness owns infrastructure only: Testcontainers, environment assembly, production-process lifecycle, health and closed-port checks, authentication bootstrap, isolated uploads, cleanup, and the deterministic external-model adapter. Recipe Enrichment, Recipe Provenance, Prompt, import, and Step Ingredient actions and database probes live beside the AI scenarios that use them.

Remove automated documentation screenshot capture from the test architecture. Existing committed documentation images remain, and future screenshots continue to be updated manually under the existing documentation policy. Acceptance scenarios never write tracked documentation assets.

## User Stories

1. As a maintainer, I want every web test to be discoverable beneath one workspace test tree, so that I do not have to know the history of the Offline and AI features to find browser coverage.
2. As a maintainer, I want one Playwright configuration for web E2E testing, so that shared runner policy cannot drift between suites.
3. As a maintainer, I want one workspace E2E command, so that “run the browser gate” has exactly one meaning.
4. As a maintainer, I want the repository-level E2E command to build the production web and server artifacts before running browser scenarios, so that stale output cannot masquerade as current acceptance evidence.
5. As a contributor iterating on an existing build, I want to run only the Offline project, so that I can get focused feedback without running AI scenarios.
6. As a contributor iterating on an existing build, I want to run only the AI project, so that I can get focused feedback without running Offline scenarios.
7. As a CI maintainer, I want one browser E2E step, so that the required gate is visible as one outcome rather than two manually coordinated jobs.
8. As a CI maintainer, I want one browser-results directory, so that traces and failures are uploaded without maintaining parallel artifact paths.
9. As a maintainer, I want Offline and AI to reuse one production-stack implementation, so that container, authentication, readiness, and teardown changes are made once.
10. As a maintainer, I want Offline and AI to keep isolated PostgreSQL, Redis, uploads, ports, users, and process state, so that one project's behavior cannot contaminate the other.
11. As a maintainer, I want the two projects to run sequentially initially, so that consolidation does not increase peak Docker, server, or browser resource usage.
12. As a maintainer, I want project isolation to permit later parallel execution without changing test callers, so that performance tuning remains possible after the refactor is stable.
13. As a contributor, I want ordinary Playwright fixtures rather than a Norish-specific test framework, so that Playwright knowledge transfers directly into this repository.
14. As a contributor, I want setup and teardown colocated in fixtures, so that a failed test cannot bypass cleanup hidden in an unrelated hook.
15. As a contributor, I want the harness to expose only behavior a scenario genuinely varies, so that tests do not learn environment-variable ordering or child-process plumbing.
16. As a contributor, I want infrastructure setup failures to identify the active project and failing phase, so that a container, authentication, process, or readiness failure is diagnosable.
17. As a maintainer, I want teardown to attempt every owned resource even when one cleanup action fails, so that a first error does not leave avoidable containers or processes behind.
18. As a maintainer, I want startup to wait for the production health endpoint before browser work begins, so that readiness races do not become flaky scenarios.
19. As a maintainer, I want stopping the production process to wait until its port is actually closed, so that an Offline assertion cannot accidentally talk to a lingering backend.
20. As a maintainer, I want the Offline project to use the production build with its installed service worker, so that App Shell, Cache Storage, IndexedDB, and document-navigation behavior remain genuine.
21. As a maintainer, I want the Offline browser profile to persist across its serial scenarios, so that the Warm Set, Offline Cache, Outbox, cookies, and service worker survive the same transitions a household member experiences.
22. As a maintainer, I want Offline scenarios to stop and restart the real production backend, so that Offline and Recovery are not simulated only in browser code.
23. As a maintainer, I want the slow-but-reachable scenario to retain a deliberately unresponsive listener, so that the Reachability Deadline remains covered separately from an immediately closed port.
24. As a maintainer, I want Offline identity changes to preserve browser storage while switching authenticated cookies, so that account isolation and dormant Outbox behavior remain covered.
25. As a maintainer, I want the existing Warm Set recipe, primary image, grocery, and calendar seed to remain deterministic, so that Offline guarantees retain their causal setup.
26. As a maintainer, I want the AI project to boot the real production server, PostgreSQL, Redis, queues, workers, repositories, realtime path, and browser UI, so that only the true external model call is replaced.
27. As a maintainer, I want the external-model adapter to reset before every AI test, so that queued responses and captured requests cannot leak between scenarios.
28. As a maintainer, I want an unexpected extra model request to fail loudly, so that a scenario cannot pass while hidden AI work consumes a stale default response.
29. As a maintainer, I want AI tests to use fresh browser pages and contexts, so that browser state from one scenario cannot make another pass.
30. As a maintainer, I want every AI test to be independently runnable, so that focused execution, retries, and failure diagnosis are trustworthy.
31. As a maintainer, I want an AI scenario that represents one journey to use explicit steps or deterministic prerequisites, so that it does not rely on an earlier test having succeeded.
32. As a maintainer, I want the expensive AI production stack to remain worker-scoped, so that browser isolation does not require restarting containers and workers for every test.
33. As a maintainer, I want the Prompt reload scenarios to restart only the production process while preserving their database and fake-model state, so that an upgrade boot remains testable without a separate harness.
34. As a maintainer, I want the fake external-model adapter to retain focused tests through the ordinary unit-test runner, so that its response planning, capture, holding, and error behavior remain deterministic.
35. As a contributor changing Recipe Enrichment scenarios, I want Recipe Enrichment actions and probes beside those scenarios, so that domain knowledge does not inflate the infrastructure harness interface.
36. As a contributor changing Recipe Provenance scenarios, I want provenance actions and stored-result probes beside those scenarios, so that their locality is preserved.
37. As a contributor changing Prompt scenarios, I want Prompt editing, persistence, and restart support grouped with Prompt coverage, so that the exceptional deployment-restart behavior is easy to find.
38. As a contributor changing Step Ingredient scenarios, I want Step Ingredient setup and probes grouped with those scenarios, so that the shared harness does not become a catalog of unrelated domain operations.
39. As a maintainer, I want a helper promoted into shared test support only after more than one caller needs it, so that hypothetical seams do not replace straightforward local code.
40. As a documentation maintainer, I want browser acceptance runs never to modify tracked screenshots, so that running a gate leaves the working tree unchanged.
41. As a documentation maintainer, I want existing documentation screenshots to remain available after capture automation is removed, so that this refactor does not degrade published documentation.
42. As a documentation maintainer, I want future screenshots updated manually under the existing feature-documentation policy, so that screenshot ownership is explicit and not presented as automated acceptance.
43. As a release maintainer, I want all existing Offline and AI browser scenarios to survive the reorganization, so that an architectural refactor does not reduce acceptance coverage.
44. As a release maintainer, I want a failed or environmentally blocked browser project reported honestly, so that consolidation cannot turn missing evidence into a passing gate.
45. As an agent working in the repository, I want one obvious browser-test seam and one conventional fixture pattern, so that future changes require less repository archaeology.

## Implementation Decisions

### Test topology

- All web browser scenarios, their fixtures, and their focused harness tests live beneath the workspace's existing test tree in a dedicated E2E area.
- The E2E area contains one Playwright configuration, an infrastructure-only harness module, an Offline project area, and an AI project area.
- The two historical browser-suite directories are removed after their contents are migrated.
- Test discovery remains suffix-driven: the ordinary unit-test runner continues to discover focused `.test` and `.spec` files, while Playwright discovers `.e2e` scenarios. Moving files does not make one runner execute the other's scenarios.

### Runner and project model

- One Playwright configuration defines two named projects: `offline` and `ai`.
- The initial configuration uses one worker and does not run the projects in parallel.
- Each project selects only its own scenarios and owns its own fixture module.
- Focused local runs use Playwright's project selector rather than separate package scripts.
- Both projects use one result directory and retain traces on failure.
- The global-setup mechanism is removed. Project-specific worker fixtures own provision, use, and teardown in one Playwright lifecycle.
- A generic profile registry, lifecycle-hook framework, capability system, custom error taxonomy, and other speculative extension interfaces are explicitly rejected. The implementation uses ordinary Playwright fixture composition.
- Playwright's fixed-command web-server facility is not used for the shared lifecycle because Offline scenarios must stop, restart, and temporarily replace the backend while a test is running, and AI Prompt scenarios require an explicit restart control.

### Shared production stack

- One private stack implementation owns build verification, isolated runtime paths, dynamic dependency URLs, Testcontainers startup, environment assembly, the production-server child process, health polling, closed-port verification, authentication bootstrap, and aggregate teardown.
- PostgreSQL and Redis continue to use the existing official Testcontainers modules. No new harness dependency is introduced.
- Offline and AI are two real adapters over the shared implementation. They supply profile-specific configuration and seeding without copying lifecycle code.
- Each project receives separate PostgreSQL and Redis containers, uploads, server port, users, environment variables, and runtime state.
- The shared implementation performs the existing two-boot authentication configuration sequence: boot for migrations and initial configuration, force password authentication and registration in stored configuration, clear relevant cached configuration, then boot again before creating deterministic users.
- The first deterministic user remains the server owner; a second user remains available for identity-isolation scenarios.
- Setup failures roll back resources already started. Teardown continues across remaining resources and reports cleanup failures without abandoning later cleanup.
- Production-process start resolves only after the real health endpoint responds. Stop resolves only after the process exits and its port is closed.
- Missing production build output fails with a message that identifies the repository-level command that builds and runs the complete browser gate.

### Offline fixture

- The Offline fixture is worker-scoped and owns one persistent browser context and page for the serial Offline journey.
- The context preserves the service worker, Cache Storage, IndexedDB, local storage, cookies, and navigation state across Offline scenarios.
- The Offline fixture exposes only the scenario controls already required by the existing suite: select the deterministic identity and transition the backend between Live, stopped, and deliberately unresponsive states.
- Backend transitions are serialized and idempotent. A transition returns only after the requested state is observable.
- Entering the deliberately unresponsive state first stops the production process, binds the test listener, and guarantees that cleanup restores a valid state.
- Offline seeding remains profile-specific. The deterministic Warm Set recipe, primary image, grocery, and calendar note are prepared after authentication bootstrap and before browser scenarios begin.
- Offline remains a serial scenario group. Its ordering is an explicit part of this test interface because persisted browser state and queued work are the behavior under test.
- The Offline fixture preserves genuine production service-worker behavior and does not replace backend requests with Playwright routing.

### AI fixture and external-model adapter

- The AI infrastructure stack is worker-scoped. PostgreSQL, Redis, uploads, the production process, workers, realtime runtime, and deterministic external-model adapter are reused across AI tests in the worker.
- Each AI test receives Playwright's ordinary fresh browser context and page, authenticated as the deterministic server owner through fixture-provided session state.
- The external-model adapter is the only mock in the production-like AI path. The AI Runtime, provider transport, queues, workers, repositories, authorized procedures, realtime events, and UI remain real.
- The external-model adapter resets its planned responses, held-response state, and captured requests before and after every test.
- Exhausting planned responses without an explicit default fails loudly and records the unexpected request.
- Existing deterministic success, permanent failure, retryable failure, invalid response, request capture, request holding, and release capabilities remain available.
- A small exceptional restart control is available only to scenarios whose observable behavior depends on a fresh production boot, notably Prompt default and upgrade behavior. Restart preserves the project's database, Redis, uploads, authentication records, and external-model adapter.
- AI tests do not share browser state and may not require another test to have run first. Multi-stage journeys use steps within one test or arrange deterministic prerequisites themselves.
- Existing serial grouping may remain only where tests share intentional server-side fixture state within one independently executable scenario file; no scenario may depend on browser state left by an earlier test.

### Test support locality

- The current catch-all AI harness module is deleted rather than moved intact.
- Infrastructure lifecycle, authentication, and the external-model adapter belong to the shared harness.
- Browser actions and direct database probes for imports, Recipe Enrichment, Recipe Provenance, Prompts, categories, and Step Ingredients belong to AI test support beside the scenarios that use them.
- Direct database probes remain test-only support. They do not become part of the production harness interface or introduce a new production repository abstraction.
- Helpers shared by multiple AI areas may move to common AI support. Single-caller helpers remain local.
- The fake external-model adapter's focused tests move with the adapter and continue to run under the ordinary unit-test runner.

### Documentation capture

- The automated documentation screenshot spec, its Playwright configuration, and its package command are deleted.
- Screenshot-writing code is removed from Offline acceptance scenarios.
- Existing committed documentation images and their references remain unchanged unless independently stale.
- Documentation continues to require screenshots for user-visible features, but their creation and update are manual and outside the browser acceptance gate.
- This internal test-architecture refactor does not add a release-notes entry or new user documentation. Contributor instructions are updated to describe the new test location and commands.

### Commands and CI

- The web workspace exposes one E2E command that runs the single Playwright configuration against an existing production build.
- The repository-level E2E command continues to build the production web and bundled server once, then invokes the workspace E2E command.
- Profile-specific package commands are removed. Focused execution passes the appropriate Playwright project selector through the workspace command.
- CI keeps its existing production build and embedded-parser preparation, then invokes one browser E2E step.
- CI uploads the single results directory on failure, including hidden trace artifacts.
- Lint ignores, contributor guidance, command comments, and any references to the two old result directories or configurations are updated as part of the same change.

## Testing Decisions

- A good test asserts observable browser behavior, persisted outcomes, or requests captured at the true external model seam. Tests do not assert private fixture call order, internal file layout, environment-variable assembly, or child-process implementation details.
- The highest and primary test seam remains the production-like browser path. The real production build, server, PostgreSQL, Redis, queue workers, repositories, authorization, realtime delivery, and UI remain active.
- Offline browser coverage continues to prove the installed service worker, Offline Cache, Warm Set, Cache Storage, IndexedDB, document navigation, Reachability Deadline, Outbox, identity isolation, sign-out handling, and Recovery with the backend genuinely stopped or unresponsive.
- AI browser coverage continues to fake only the true external model call while proving imports, Recipe Enrichment, Recipe Provenance, Ingredient Linking, Prompt behavior, bulk enrichment, persistence, queues, realtime updates, and rendered outcomes through the production stack.
- Every existing Offline scenario is migrated without weakening its assertions or replacing genuine backend loss with request interception.
- Every existing AI scenario is migrated without weakening its assertions or replacing the real queue, worker, repository, authorization, realtime, or UI path.
- The fake external-model adapter retains focused unit coverage for response sequencing, defaults, held responses, request capture, success bodies, invalid bodies, and HTTP errors.
- The shared stack implementation is tested through the fixture interface and the two browser projects. New unit tests for private lifecycle helpers are added only when they contain independently meaningful behavior that is difficult to observe through project startup and teardown.
- The AI project is run as a whole and representative AI files are run independently to prove they no longer rely on browser state or prerequisites left by earlier tests.
- The Offline project is run independently to prove its fixture creates and tears down the complete isolated profile.
- The combined E2E command is run to prove project selection, sequential execution, shared configuration, result collection, and aggregate teardown.
- A deliberate AI failure must produce a trace in the single results directory, and CI artifact configuration must include it.
- Running the browser gate must not create or modify tracked documentation screenshots.
- The old Playwright configurations, old global setups, old result paths, profile-specific commands, automated capture files, and catch-all harness module must have no remaining references after migration.
- Completion requires `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, and the combined `pnpm test:e2e` gate.
- Focused validation also runs the `offline` and `ai` Playwright projects independently against the same build.
- Passed, failed, and environmentally blocked gates are reported separately. Docker or browser unavailability is blocked evidence, not a pass.

## Out of Scope

- Changing any user-visible Norish behavior.
- Changing the Offline, Live, Reachability Deadline, Offline Cache, Warm Set, Outbox, Replay, Parked, Conflicted, or Recovery contracts.
- Changing Recipe Enrichment, Recipe Provenance, Ingredient Linking, Prompt, or AI Runtime behavior.
- Adding, removing, or redesigning product acceptance scenarios beyond the restructuring needed to make existing AI tests independently runnable.
- Adding a generic browser-profile framework for hypothetical future suites.
- Extracting a reusable E2E package for other workspaces.
- Adding a third-party Playwright/Testcontainers integration library.
- Running Playwright itself inside a container.
- Replacing the existing Testcontainers-based PostgreSQL and Redis dependencies.
- Replacing the production-server child process with a Docker image or Playwright's fixed web-server launcher.
- Parallelizing the Offline and AI projects in this change.
- Adding browser sharding, retries, or additional browser engines.
- Giving every AI test a fresh database or fresh production process.
- Making Offline scenarios independently reorderable when their purpose requires one persistent browser journey.
- Adding automated visual-regression testing.
- Replacing or regenerating existing documentation screenshots.
- Removing the requirement that user-visible feature documentation includes screenshots.
- Changing mobile tests or introducing mobile browser E2E coverage.
- Creating a product-domain glossary term or ADR for this test-only architecture.

## Further Notes

- “One harness” means one shared infrastructure implementation and one runner interface, not one mutable runtime shared by Offline and AI. The two projects remain isolated because Offline deliberately stops its backend and AI owns controlled external-model state.
- “One global setup” is intentionally realized through Playwright worker fixtures rather than the legacy global-setup option. Fixtures keep setup and teardown in the runner lifecycle and allow the tests that need process or fake-provider control to retain those live objects.
- The Offline and AI differences are load-bearing adapters: Offline supplies deterministic Warm Set data and backend reachability changes; AI supplies configuration plus the deterministic external-model adapter. Their duplicated container, authentication, environment, and process implementation is not load-bearing and is consolidated.
- The directory move improves locality but is not sufficient by itself. The architectural value comes from deleting duplicated lifecycle implementation and narrowing the shared harness interface.
- No `CONTEXT.md` update is needed because this work introduces no product-domain language. No ADR is needed because the refactor is reversible, follows Playwright's standard fixture model, and does not establish a surprising production-system constraint.
- Specification status does not imply implementation. Code, command, CI, and contributor-documentation changes remain to be completed after this spec.
