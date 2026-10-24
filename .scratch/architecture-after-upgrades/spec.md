# Architecture after the 0.26 upgrades

Status: ready-for-agent

Settled in a `/grill-with-docs` session on 2026-10-13, after the 0.26 dependency sweep moved BullMQ to 6.3, ioredis to 6 and Next.js to 16.4 with React 19.3 (`.scratch/dependency-upgrades/`). Four read-only audits mapped the queue, Redis, web and auth code against the new versions; every claim this spec rests on was re-read in the installed packages. The vocabulary is CONTEXT.md's **Cancelled** (added that day), **Realtime Hub**, **Lagged**, **AI Runtime**, **Outbox**, **Device Preference** and **Device Kind**. Nothing here is expensive to reverse, so it adds no ADR; the closest candidate, the auth gate leaving the proxy, carries its reasoning in its ticket. Target Version: 0.26.0-beta, the open rc. Better Auth 1.7 is out of scope; it landed on the sweep branch (`cddffabf`, `.scratch/dependency-upgrades/issues/09` and `10`), and the auth gate below builds on it.

Re-read against the sweep's open tickets in a second `/grill-with-docs` session on 2026-10-14. That session settled the shutdown rules, the leftover-session case, the release-note line for always-on workers and the liveness and readiness endpoints (ticket 11). The dependency-upgrades plan was still being worked on then and was left untouched: whatever this plan needs from it is written here. That plan is now done. A third session the same day, also on 2026-10-14, added the move off the hoisted install, production running the source without tsdown, and the image's size (tickets 12 and 13). Every number there was measured in a throwaway clone first.

## Problem Statement

The upgrades landed as version bumps. The code around them still carries workarounds for limits the new versions lift, primitives we built by hand that BullMQ and Next now ship, and a few designs that never did what they claimed.

**Background jobs.**

- Fourteen queues start their worker on demand and stop it when idle, to "save memory and CPU". They save neither: an idle on-demand queue holds a blocking Redis connection to listen for work, exactly as an idle worker would, and every worker module is loaded at boot anyway.
- The design has a real cost:
  - A retry waiting out its backoff (a CalDAV sync's first retry waits 60 seconds, longer than the 30-second idle pause) is not counted as work, so the worker stops and the retry waits for the next job on that queue.
  - A retry pending across a restart never starts a worker at all.
  - The same design caused the boot hold, the failed first run and the never-reported-running bugs fixed during the sweep.
  - It rules out delayed jobs, which blocks debouncing.
- Three producers hand-roll deduplication, each with a check, a removal and a re-read to catch the race. BullMQ does this atomically in one `add`:
  - recipe import
  - the catalogue refresh asked for at boot
  - CalDAV sync, which also hand-rolls "replace the waiting sync, follow up after the running one"
- No job can be stopped. An administrator watching an AI job run away can only wait. A restart keeps spending AI tokens on a job that will retry anyway.
  - The processor wrappers drop BullMQ's abort signal, so even a worker that wanted to stop could not.
  - The 0.26 sweep's ticket 17 assumed closing a worker aborts its AI work. It does not.
- Every progress write copies the job's whole step timeline into a Redis events stream that nothing reads back. One ingredient round once grew it to 850 MB.
- Each queue declares its own retention (CalDAV's "24 hours, persisted to Postgres", for one). None of it has ever applied, because the administrator's retention setting overrides all of it.

**Redis.** Moved to the dependency sweep on 2026-10-14 (`.scratch/dependency-upgrades/` tickets 34 and 35); kept here for the record.

- When Redis restarts and leaves a half-open socket, the Realtime Hub keeps listening on a dead connection. It misses every Realtime Event, without a Lagged signal, until the operating system's keepalive gives up, which takes minutes.
- The realtime E2E only passes because the sweep reordered it so the Redis restart runs last.
- The connection options hand-roll a reconnect backoff and keepalive that ioredis 6 now ships as defaults.

**Page loads.**

- Before any skeleton can paint, the proxy fully verifies the session on every navigation, prefetch and image request: a Redis read, a Postgres row and three decrypts. The layout then reads the session again.
- A page of recipe cards pays the full verification once per image.
- Next's own guidance is that the proxy makes an optimistic check and the data layer authorises.

**The web server.**

- The custom server parses every URL with a deprecated API (DEP0169 on Node 26), only for Next to turn it back into a string.
- A static file helper never serves anything: its exclusion list contains `/`, which excludes every path.
- The proxy keeps a WebSocket branch its own matcher makes unreachable.
- The error page shows an untranslated "Something went wrong!" with a deprecated reset callback, and there is no global error boundary.
- CI type-checks before Next has generated its route types.
- The build uses standalone output, which Next documents as incompatible with a custom server, and the image uses only a fraction of what it produces.

**Health checks.**

- One endpoint, `/api/v1/health`, answers two different questions: whether to restart Norish and whether to send it traffic.
- It answers 503 when Postgres or the parser is down, and the sweep's ticket 53 adds Redis.
- The image's `HEALTHCHECK` calls it. An orchestrator that restarts unhealthy containers (Swarm, Kubernetes liveness, autoheal) would therefore restart Norish through every Postgres or Redis outage, and a restart fixes neither.

**Installs and the image.**

- The workspace installs hoisted, a flat `node_modules` from which any workspace can import any package.
  - About 20 imports across 7 workspaces use packages their workspace never declares. One is live code: shared-server's AI runtime imports `@ai-sdk/provider`, which it declares only as a devDependency.
  - Which copy of a package lands at the root is luck, and it has shipped two bugs: React Native's ws@7 in the deploy (#361), and archiver 7 at the root with 8 nested, where vitest passed and the built server threw (`e468650b`).
  - Its only context is the Expo app it arrived with, which has since left the workspace.
- tsdown bundles the custom server, while dev runs the same source through tsx.
  - The bundle loads 43 packages at run time, and apps/web declares only a few of them. It finds the rest only because the install is flat.
  - A hand-kept `neverBundle` list decides what stays out of the bundle.
- The image is 388 MB to download and 1.77 GB unpacked, and much of it never runs: 138 MB of source maps, Next's 86 MB SWC compiler, client libraries Next has already bundled, an unused 23 MB `libpython`, and the workspace code twice.

**The React and Next line.**

- Next 17 makes Cache Components the default. Norish does not know what they would win for it or what they would cost.
- React 19.3 ships a primitive for the "render only after mounting in the browser" pattern that several components hand-roll.
- Nothing measures the service worker precache, which every installed app downloads again each release.
- The React Compiler is stable, but its lint rules are switched off and it is not used.

## Solution

**Background jobs.**

- Every queue has an always-on worker, started one way. That one way wraps the processor in the operation context and the model ledger, logs worker errors through the server logger, registers the worker for shutdown, and passes BullMQ's abort signal on.
- Delayed retries run on time, and debouncing becomes possible.
- Recipe import, the boot catalogue ask and CalDAV sync use BullMQ's deduplication. A burst of calendar edits becomes one sync.
- An administrator can cancel a running job from the job monitor:
  - The job ends **Cancelled**, never retries, and records that an administrator stopped it.
  - A restart aborts AI calls in flight and puts those jobs back to waiting, so the next boot runs them without spending a retry.
- The events stream is capped, and the administrator's retention setting is the only retention there is.

**Redis.** Moved to the dependency sweep (tickets 34 and 35).

- The Realtime Hub notices a dead socket within seconds and reconnects. Its subscriptions see Lagged and refetch, as for any reconnect.
- The hand-rolled reconnect options give way to ioredis 6's defaults.
- The realtime E2E goes back to its original order and becomes the regression test.

**Page loads.**

- The proxy checks only that a session cookie is present.
- The real check happens where data is read:
  - the signed-in app's layout, which already reads the session and the profile
  - the recipe media helper
  - the avatar route
  - tRPC, unchanged
- A signed-out reader, or a session whose account no longer exists, still lands on the login page with its destination kept. An image request without a valid session is not served.
- The proxy's unreachable WebSocket branch goes with the rewrite.

**The web server.**

- The custom server hands requests straight to Next.
- The dead static helper is deleted.
- The error page is translated and uses the current retry callback, and a global error boundary exists.
- CI generates Next's route types before it type-checks, and pages use Next's generated prop types.
- Standalone output is dropped if a trial build shows the image still works and is smaller or faster to build. Otherwise it stays, with the numbers recorded.

**Health checks.**

- `/api/v1/health/live` answers whether to restart Norish. It checks only what a restart can fix: the process and the parser it runs.
- `/api/v1/health/ready` answers whether to send Norish traffic. It checks Postgres and Redis, and reports the parser without failing on it.
- `/api/v1/health` is removed (the maintainer, 2026-10-15: no compat code in 0.26); an Upgrade note says which endpoint replaces it.
- The image's healthcheck calls live.

**Installs and the image.**

- The workspace installs isolated, pnpm's default: a workspace imports only what it declares, and the image installs the same layout.
- Production runs the server's source through tsx, as dev does. tsdown, its externals list and `dist-server` are gone, and every package loads its own dependencies.
- `pnpm deps:cycles` checks only the workspace import edges. The devDependency guard it briefly grew was removed on 2026-10-15 (the maintainer: a hand-rolled check prone to breaking); the image boot and the pre-release test catch a runtime import of a devDependency.
- The image ships only what runs: about 275 MB to download.

**The React and Next line.**

- A spike measures Cache Components with a text-free static shell, against a baseline taken after the proxy change. They are adopted only if the skeleton arrives measurably sooner and first-paint fidelity holds.
- The mounted-flag pattern moves to React 19.3's `browser()`.
- Opening a recipe from its card carries the card's image into the recipe's hero with a shared-element transition.
- The precache is measured once.
- The React Compiler is turned on app-wide, with its lint rules back on.

## User Stories

1. As a self-hosting operator, I want background jobs to pick up again on their own after Redis restarts, so that imports and enrichments never sit stuck until I restart Norish. (The reconnect half is delivered by the sweep's ticket 34.)
2. As a reader whose recipe import failed transiently, I want its retry to run when its backoff ends, so that the import finishes without me queueing another one.
3. As a household member whose calendar sync hit a CalDAV error, I want the retry to run on time even if nobody edits the calendar again, so that my calendar app catches up by itself.
4. As a self-hosting operator who restarts Norish while a retry is waiting, I want that retry to run after the restart, so that a restart never strands work.
5. As a self-hosting operator, I want every background worker to log its errors through Norish's normal log, so that a Redis blip shows up as a few readable lines instead of dozens of raw stack traces.
6. As an administrator, I want every job in the job monitor to show which AI model it used, whichever queue ran it, so that the model ledger is never missing for a worker someone wired up by hand.
7. As a reader who taps import twice on the same URL, I want one import, so that I never get the same recipe twice.
8. As a reader who imports a URL again after its first import finished, I want the new import to run, so that a finished job kept in the history never blocks a deliberate re-import.
9. As a household member who edits several meals in a row, I want those edits to reach my calendar app in one sync, so that Norish doesn't sync once per keystroke-sized change.
10. As a household member who edits a meal while a sync is running, I want my edit to sync right after the running one, so that the last change is never lost.
11. As a self-hosting operator, I want the boot catalogue refresh asked for once per boot, so that restarting twice in a minute doesn't queue two refreshes.
12. As an administrator, I want to cancel a running job from the job monitor, so that an AI job that's taking too long or going wrong stops spending tokens.
13. As an administrator, I want a cancelled job to stay cancelled, so that it doesn't quietly start again on retry.
14. As an administrator, I want the job monitor to show a cancelled job as Cancelled, and that an administrator stopped it, so that I can tell it apart from a job that failed.
15. As an administrator, I want the cancel button to show "Cancelling…" until the job has actually stopped, so that I know my click was received while the current step finishes.
16. As an administrator, I want cancel offered on every queue's running jobs, so that I don't have to remember which kinds can be stopped.
17. As a self-hosting operator who restarts Norish during an AI enrichment, I want the AI call aborted at once, so that the restart doesn't keep paying for a response nobody will read.
18. As a self-hosting operator who restarts Norish during an AI enrichment, I want that enrichment to run again after the restart without using up one of its retries, so that a restart is never mistaken for a cancel or a failure.
19. As a self-hosting operator, I want Redis memory to stay bounded however many progress updates jobs write, so that a large ingredient round can't fill my Redis.
20. As an administrator, I want the job retention I set to be the only retention in effect, so that what the settings page says is what Norish does.
21. (Delivered by the sweep's ticket 35.) As a reader, I want realtime updates to keep arriving after Redis restarts, so that a household member's change shows up without a reload.
22. (Delivered by the sweep's ticket 35.) As a reader whose realtime connection missed events during a Redis restart, I want the page to refetch what it missed, so that I never look at a stale grocery list believing it's live.
23. (Delivered by the sweep's ticket 35.) As a self-hosting operator, I want Norish to notice a dead Redis connection within seconds, so that a half-open socket after a network hiccup doesn't silently stop realtime for minutes.
24. (Delivered by the sweep's ticket 35.) As a self-hosting operator, I want Norish's Redis connections named in `CLIENT LIST`, so that I can tell which connection is which when I look.
25. As a reader on a phone, I want a page's skeleton to appear as soon as possible on a cold load, so that the app feels quick on a slow connection.
26. As a reader browsing a page of recipe cards, I want the images to load without a database lookup each, so that a full grid appears quickly.
27. As a reader whose session expired, I want to land on the login page and come back to the page I asked for after signing in, so that an expired session costs me one sign-in, not my place.
28. As a reader whose account was deleted, I want to be signed out at my next page load, so that a deleted account can't keep browsing. (Met by the sweep's ticket 10, which ends a deleted user's sessions at once. Ticket 06 keeps it true for a session that outlived a failed deletion.)
29. As a household member, I want recipe images, step images, cookbook images and avatars served only to signed-in readers (and to share links for what they share), so that private recipes stay private.
30. As a reader with a share link, I want the shared recipe's images to keep loading, so that sharing works exactly as before.
31. As a self-hosting operator, I want a new signed-in page or route added later to be protected without anyone remembering to protect it, so that a forgotten guard is caught by the build, not by a leak.
32. As a self-hosting operator on Node 26, I want Norish to start without deprecation warnings, so that its log shows only what matters.
33. As a reader who hits an unexpected error, I want the error page in my language with a working "Try again", so that I can recover without a reload.
34. As a reader who hits an error in the app's outermost layout, I want a readable error page instead of a blank screen, so that I know what happened.
35. As a contributor, I want CI to type-check with Next's generated route types, so that a wrong page parameter fails in CI and not only in my editor.
36. As a contributor, I want page and route props typed by Next, so that I don't hand-write parameter types that can drift from the routes.
37. As a self-hosting operator, I want the image built from only what the server runs, so that it is no bigger than it needs to be.
38. As the maintainer, I want to know what Cache Components win for Norish before Next 17 makes them the default, so that the move to 17 is a decision I made with numbers, not a surprise.
39. As a reader, I want a page's first frame drawn with my Device Preferences already applied, whatever the rendering mode, so that nothing I hid flashes on screen.
40. As a reader who goes back to a page, I want my scroll position and what I'd typed still there, so that going back feels like going back.
41. As a reader who goes back to a page, I want panels and dialogs I left open to be closed, so that I return to the page and not to a half-finished action.
42. As a reader who opens a recipe from its card, I want the card's image to carry into the recipe's hero, so that I keep track of what I tapped.
43. As a reader who prefers reduced motion, I want that transition skipped, so that the app respects my setting.
44. As a reader, I want the theme and language switches to render without a flicker, so that the menu doesn't jump when it appears.
45. As a reader with Norish installed as an app, I want each release to download no more than it needs, so that updates are quick on mobile data.
46. As a reader, I want screens to re-render only when something on them changed, so that the app stays smooth on an older phone.
47. As a contributor, I want the React Compiler's lint rules on, so that code the compiler can't optimise is flagged when I write it.
48. As a self-hosting operator, I want a health check that fails only when restarting Norish would help, so that my orchestrator doesn't restart Norish through a Postgres or Redis outage.
49. As a self-hosting operator behind a load balancer, I want a health check that says whether Norish can serve requests, so that traffic stops while Postgres or Redis is down and returns when they are back.
50. As a self-hosting operator whose probes call `/api/v1/health`, I want the release notes to tell me what replaces it, so that I can repoint my probes when I upgrade. (Changed 2026-10-15: the endpoint is removed, not kept.)
51. As a contributor, I want an import of a package my workspace doesn't declare to fail typecheck or tests, so that it never works on my machine and then breaks in the image.
52. As a contributor, I want production to load the same source, resolved the same way, as dev and the tests, so that "the tests passed and the built server threw" can't happen.
53. As a contributor, I want a gate to fail when source code imports a devDependency, so that a package the image leaves out is caught before release, not on the first request that needs it.
54. As a self-hosting operator, I want a smaller image, so that each upgrade downloads less.
55. As a self-hosting operator who overrides the container's command, I want to be told the new one, so that my setup keeps starting.

## Implementation Decisions

### Background jobs

- **One way to start a worker.**
  - A small, non-lazy `createWorker(queue, processor, options)` in the queue package is the only way a worker starts. It does exactly four things:
    - wraps the processor in the operation context and the model ledger
    - attaches an `error` listener that logs through the server logger
    - registers the worker for shutdown
    - passes the processor a third parameter, BullMQ's abort signal, which BullMQ only creates when the processor takes three parameters
  - All sixteen workers start through it, including the two built by hand today (scheduled tasks and store lookup).
  - The lazy-worker manager, `defineLazyWorker`, and their tests are deleted, with no alias left behind. The store-lookup "delay trap" guard and the boot-time lazy registration go with them.
  - An idle server holds the same nineteen Redis connections it holds today: the publisher, the hub, the shared BullMQ client and one blocking connection per worker. The fourteen QueueEvents listeners disappear.
- **Shutdown has a bounded close.**
  - Once the shutdown budget runs out, the workers are force-closed (`worker.close(true)`).
  - No BullMQ connection sets `commandTimeout`. In ioredis 6.0.0 it applies to every command (`Redis.js:368`), including the worker's blocking wait for its next job, which lasts up to `drainDelay` (5 s since the sweep's ticket 51). A shorter timeout would fail every idle wait.
  - The sweep's ticket 35 also bounds BullMQ's close, and its choice between a command timeout and a force-close is still open there. If it lands a command timeout, ticket 01 replaces it with the force-close.
- **Deduplication.**
  - The boot catalogue ask adds its job with a fixed deduplication id. BullMQ releases the key when the job finishes, so the next boot asks again.
  - Recipe import:
    - It uses today's deterministic id as the deduplication id, with a unique job id.
    - A duplicate is recognised by `add` returning a job whose id differs from the one asked for.
    - Kept finished jobs no longer block a re-import.
    - An import already in flight when the upgrade lands has no deduplication key, so one duplicate is possible in that window. Accepted.
  - CalDAV sync:
    - It adds with a delay of about two seconds and `deduplication: { id, replace: true, keepLastIfActive: true }`. This replaces the hand-rolled replace-and-follow-up.
    - `replace` only acts on a delayed job, which is why the delay is required.
  - Enrichment keeps its deterministic ids and kept history. Its status read finds finished runs by that id, and automatic runs merge into an already-completed run, so deduplication would break both.
- **Cancellation.**
  - The abort signal reaches the AI Runtime as its abort signal. The runtime is the one seam that talks to a model (ADR-0015), so this is one change there.
  - Two callers, two outcomes:
    - **Admin cancel.** A new admin procedure calls the worker's `cancelJob(jobId, reason)` in process. Norish is one process, so the worker is reachable. The processor wrapper turns that abort into BullMQ's `UnrecoverableError`, so the job fails without a retry, with a reason that records that an administrator stopped it. The job monitor shows it as **Cancelled**.
    - **Shutdown.** Shutdown calls `cancelAllJobs()` with a shutdown reason before closing the workers. The wrapper answers that abort with `job.moveToWait(token)` and throws BullMQ's `WaitingError`. The job goes back to waiting without spending an attempt or waiting out a backoff, and the next boot runs it first, as CONTEXT.md's **Cancelled** promises for work a restart interrupts. A retryable failure would spend an attempt each time: an import with three attempts, restarted three times during its AI step, would fail for good.
    - If Redis is unreachable at shutdown, `moveToWait` fails and the job stays active. BullMQ's stalled-job check puts it back on the next boot.
  - A processor stops only where it checks the signal, which in practice is the AI Runtime call. Non-AI work (a parser fetch, database writes) finishes its current step.
  - Cancel is offered for running jobs on every queue. The admin router stops refusing active jobs for this one action, and the button reads "Cancelling…" until the job leaves `active`.
- **Retention.**
  - The shared queue options set `streams.events.maxLen` to about 1000, and each queue's events stream is trimmed once at boot. Nothing reads the stream's history; QueueEvents is gone, and the job monitor reads job state, not events.
  - Every Queue is constructed through the registry. A Queue constructed elsewhere would rewrite the stream cap in the queue's metadata, and the lazy manager's private Queue did exactly that.
  - The per-queue `removeOnComplete`/`removeOnFail` defaults are deleted. The administrator's retention setting is the single source.

### Redis

Moved to `.scratch/dependency-upgrades/` on 2026-10-14, where the maintainer chose to fix it before the sweep merges:

- **Ticket 34:** RESP3 with no protocol pin, ioredis 6's connection defaults in place of the hand-rolled retry strategy, keep-alive and connect timeout, and one options builder for pub/sub and BullMQ. This reverses the decision that RESP2 stays: the maintainer wants no `protocol: 2` anywhere. Under ioredis 6's `legacy` reply mapping, the only reply shape that changes is a Lua `false` (`0` instead of `null`), and no BullMQ 6.3.14 script replies with one.
- **Ticket 35:** the publisher's and the hub's socket timeout, the hub's PING heartbeat, Lagged on reconnect (ADR-0034, unchanged), no UNSUBSCRIBE before quitting, connection names, a bounded shutdown, and the realtime E2E back in its original order.

### Page loads and the auth gate

- The proxy checks only that a session cookie is present. With no cookie, it redirects to the login page with the destination as the callback.
  - It no longer reads Redis or Postgres or decrypts anything.
  - It forwards the original path to the app as a request header, so the layout can keep the destination when it redirects.
- The signed-in app's layout is the page gate:
  - It already reads the session and the stored preferences once per request.
  - No session means a redirect to the login page with the forwarded destination.
  - It reads the session through the existing `getVerifiedSession` (`packages/auth/src/session.ts`). A session whose account no longer exists is revoked there, as the proxy does today, and the layout redirects it the same way. (The spec avoids "orphaned session": **Orphaned** in CONTEXT.md names a recipe or cookbook whose owner is gone.)
  - Since the sweep's ticket 10, deleting an account ends its sessions at once (`packages/auth/src/account-deletion.ts`). A session can outlive its account only when that deletion fails after the user row is gone, for example with Redis down. The revoke covers that case at no new cost.
  - The settings page's separate session read reuses the layout's per-request read.
- The recipe media helper's owner path requires a valid session. Its share path keeps its share-token check.
- The avatar route requires a valid session.
- An unauthorised media request is answered like a missing file (404, not cached), matching how the recipe editor answers 404 for 403.
- The exports already check the session themselves, and tRPC and the WebSocket keep their own authentication.
- A structural test fails the build if any route handler under the signed-in app skips the session check.
- The proxy's WebSocket branch, which its own matcher makes unreachable, is deleted with the rewrite.

### The web server

- The custom server passes each request straight to Next's handler without parsing its URL first.
- The static file helper and its call are deleted, and the `mime` dependency with them.
- The error page:
  - It uses the `retry` callback, with copy from the message catalogue.
  - A global error boundary renders its own document. It takes its copy from the message catalogue by the browser's language with an English fallback, since the root layout and its provider are gone when it renders.
- `next typegen` runs before type checking, in CI and in the local typecheck script. Hand-written `params: Promise<…>` types are replaced with Next's generated page, layout and route-context prop types.
- The standalone trial moved to ticket 13, with the rest of the image work.

### Installs, the server build and the image

- **The isolated linker.**
  - `nodeLinker: hoisted` goes, and nothing brings hoisting back: no `publicHoistPattern`, no hoisted deploy. Dev, CI and the image share one layout.
  - In the clone, isolated broke typecheck (about 620 errors), tests and build until three fixes were made:
    - `preserveSymlinks` was deleted from `tooling/typescript/compiled-package.json`; it caused most of the errors.
    - `getOpenApiDocument()` was given a return type.
    - About ten missing declarations were added.

    Then every gate passed with the same test counts. Install time and size didn't change (6 s, 1.3 GB).

  - Three breaks that no gate catches are fixed in the ticket:
    - The Tailwind `@source` path: HeroUI's classes would silently vanish.
    - The devcontainer's `prettierPath`.
    - Two `packages/db` tests that import api and queue. Declaring those would create a cycle, so the tests move to `packages/api/__tests__/`.
- **No tsdown.**
  - Production runs `node --import tsx server/index.ts` from apps/web; dev already runs this source through tsx. Use `--import`, not the `tsx` CLI, which forks a second process.
  - Every package loads its own dependencies, so apps/web takes on none of the 42 declarations a bundle in `apps/web/dist-server` would have needed.
  - The cost, measured in the image:
    - boot is 8.1 s in a new container and 5.4 s on restart, against 6.0 s and 4.1 s for the bundle
    - about 65 MB more memory, plus an esbuild process of about 20 MB after a compile
    - 20 MB more image
    - a module loaded on demand compiles on first use
  - Node 26's own type stripping was rejected. It refuses files whose real path is under `node_modules`, which is where the deployed packages live. The code would also need 842 imports given a `.ts` extension, plus 13 constructs Node can't strip.
- **Dependencies versus devDependencies.**
  - Without a bundle, `pnpm deploy --prod` decides what the image holds. A run-time import of a devDependency then breaks only in the image, and only on its code path.
  - The workspace import check that `pnpm deps:cycles` already runs fails on such an import. It is extended for this, because the sweep deleted eslint-plugin-import and its `no-extraneous-dependencies` rule.
  - In apps/web only `server/**` is held to the rule, because Next bundles the rest at build time.
- **The image.**
  - The deploy is isolated: `node_modules/.pnpm` is the store.
    - Its folder names match the build workspace's, because both come from the lockfile, so Next's links for pg, pino and sharp resolve.
    - That holds only while the deploy stays at `/app/node_modules`.
  - `CMD` becomes `node --import tsx /app/apps/web/server/index.ts`.
  - The size work (ticket 13), verified on a repack of the tsx image, takes it from 405 to 275 MB compressed and from 1.87 to 1.07 GB unpacked.
    - Where a package is in the image only because of a wrong declaration, the declaration is fixed: apps/web's client-only libraries become devDependencies.
    - Filled optional peers are removed by name.
    - Source maps, `@next/swc-*`, type declarations, docs, Python's unused parts and the second copy of the workspace code go.
  - Ticket 13 also decides whether production reads Next's config from `.next/required-server-files.json` instead of running `next.config.js` at boot.
    - It saves 23 MB compressed and 258 ms.
    - It sets a private `__NEXT_PRIVATE_*` variable, the one Next's own standalone server uses, so the standalone trial makes the call.
  - No CI step boots the image, because the maintainer tests every image before shipping it. The store-folder cut rests on static analysis and Next's traces, so that test includes a URL import, a video import, a HEIC upload and an AI job.

### Health checks

- Two new tRPC OpenAPI procedures sit beside `health` in `packages/trpc/src/routers/config/procedures.ts`, under the same Health tag, with `protect: false`:
  - **`GET /api/v1/health/live`** answers 200 while the process responds and the parser answers its own health check. It checks no Postgres and no Redis.
    - The parser is included because Norish runs it. The custom server starts it as a child process on the internal parser URL (`apps/web/server/embedded-parser.ts`), and a restart fixes a parser that hangs. A parser that exits already shuts the server down.
  - **`GET /api/v1/health/ready`** answers 503 when Postgres or Redis fails, reusing the sweep's ticket 53 Redis ping. The parser's state is in the response body, but it doesn't fail the check, because the parser is needed only for URL imports. It waits on the parser two seconds at most, like the Redis ping, so a hung parser can't hold it.
- **`GET /api/v1/health`** is removed, with an Upgrade note (changed 2026-10-15; it was first kept as deprecated).
- **Who calls what:**
  - The image's `HEALTHCHECK` and `docker/docker-compose.example.yml` call live. Docker has only one healthcheck, and Swarm and autoheal restart on it.
  - `docker/docker-compose.test.yml` and the E2E harness (`apps/web/__tests__/e2e/harness/production-stack.ts`) call ready. Where the harness needs the parser, it checks the parser's own health.
  - The docs point Kubernetes readiness probes and load balancers at ready.
- The API reference is drawn from `openapi.json`, so it is regenerated.

### The Cache Components spike

- **Baseline.** Cold-load time to skeleton on a phone profile, measured after the proxy change has landed, so the two wins are not counted together.
- **Variant.**
  - `cacheComponents` on.
  - The root layout's static part is the document and the parts of the skeleton that need no request data.
  - `lang` comes from the instance's default locale, a cacheable read, and is corrected in the browser for readers on another locale.
  - Everything with text, and everything shaped by Device Preferences, renders inside Suspense.
- **Adopt only if both hold:**
  - the skeleton arrives measurably sooner
  - first-paint fidelity holds: the Device Preferences guarantee that the wrong shape never paints, skeletons included
- **The tension the spike must measure.** Today's skeletons are themselves shaped by Device Preferences (the recipe skeleton drops its rating and nutrition placeholders when those are hidden), so a static skeleton cannot honour them. What remains static may be only the chrome.
- **If adopted:**
  - The login and signup pages lose their removed segment configs.
  - The service worker route is hand-written with a cached helper, replacing the third-party route export that does not support Cache Components. Serwist still owns the worker (ADR-0006).
  - Routes kept mounted by `<Activity>`:
    - Transient overlays (panels, dialogs, menus) close when their route is hidden.
    - Scroll resets that run on mount move to navigation.
    - Inputs, scroll position and expanded sections are kept, as Next intends.
- **If not adopted:** `cacheComponents` stays off, and the ticket records the numbers for when Next 17 ships.
- The locale does not move into the URL.

### React 19.3

- `use(browser())` replaces every mounted-flag pattern: the theme switch, the language switch and any others a search finds.
- Page transitions: every page slides in by direction, and the navbar's tabs slide in their bar order (`components/page-transition.tsx`). A card-to-hero shared element was built first and dropped. Reduced motion skips them, and Motion keeps every in-page animation.
- `next analyze` runs once against the precache, and its findings go in the ticket. Acting on them is a separate decision.

### React Compiler

- `reactCompiler` is on app-wide in infer mode. The compiler lint rules switched off today are switched back on, and what they flag is fixed.
  - The sweep's ticket 39 removes eslint-plugin-react-hooks, so @eslint-react owns the hooks rules: switch its `refs`, `immutability` and `set-state-in-effect` back on.
  - `incompatible-library` and `preserve-manual-memoization` exist only in eslint-plugin-react-hooks, which stays removed. Without them, nothing reports a component the compiler skips; the compiler still leaves such a component as it is.
- Existing `useMemo`/`useCallback` stay, since the compiler works with them. New code doesn't add them.
- Render counts on two heavy screens are recorded before and after.
- Hook aliases keep a `use` prefix: a non-prefixed alias of a hook gets memoised into a conditional hook call, which the mobile app has already hit.
- The experimental Rust compiler is not used.

## Testing Decisions

- A good test drives behaviour from outside and observes outcomes, never internals. The lazy-worker tests that read the manager's private registry are an example of what not to repeat. The tests of deleted modules are deleted with them.
- **Rules carried over from the sweep**, which this plan inherits without editing that plan:
  - Every real-Redis test connects through the production connection options and uses the shared Redis image constant from the sweep's ticket 34, never a bare `{ host, port }` or another Redis version.
  - Tests rely on Vitest 5's `clearMocks` default (the sweep's ticket 31) and add no `vi.clearAllMocks()`.
  - The sweep's ticket 35 regression stays green after ticket 01: `realtime.e2e.ts` runs the Redis restart before the server restart, and the shutdown log names no step over budget.
- **Seam 1: the queue package against a real Redis.** A Redis testcontainer, a producer adding a job, a worker started through `createWorker`, and the job's observed state. Prior art: the scheduled-tasks producer Redis test and the lazy-worker Redis test. It covers:
  - a delayed retry runs when its backoff ends, with no other job on the queue
  - a worker error reaches the logger
  - the processor receives the signal
  - importing the same URL twice yields one job, and importing it again after completion yields a new one
  - a burst of CalDAV adds yields one sync, and an add during a running sync yields exactly one follow-up
  - admin cancel ends the job failed, without retry, with the administrator's reason; shutdown cancel puts it back to waiting with its attempts unchanged
  - the events stream stays at its cap
- **Seam 2: browser E2E against the production-like stack.** The existing `ai` and `realtime` Playwright projects and their fixtures. It covers:
  - the realtime spec back in its original order (a Redis restart that leaves a half-open connection, then a server restart) as the half-open regression test, now in the dependency sweep's ticket 35
  - a signed-out reader redirected to login and returned to the requested page after signing in
  - a media request without a session not served, and a share link's images still served
  - an administrator cancelling a running job in the job monitor and seeing it Cancelled, next to the existing job monitor coverage in the decision-model spec
  - if Cache Components are adopted: a back-navigation pass, with the existing first-paint fidelity spec staying green
- **One structural test** asserts that every route handler under the signed-in app performs the session check.
- The layout's gate has a test for a session whose user row is gone: it is revoked and redirected to the login page. The deleted-account path itself is covered by the sweep's ticket 10 (`auth-handler.test.ts`).
- The health tests (`packages/trpc/__tests__/openapi/health.test.ts`) cover each endpoint's failure cases: live fails on a parser that doesn't answer and ignores Postgres and Redis; ready fails on Postgres or Redis and ignores the parser, waiting on one that never answers no longer than two seconds; the removed `/health` answers 404.
- The AI Runtime's existing unit tests, with their mocked transport, gain one assertion that the abort signal reaches the transport.
- **Measurements, recorded in their tickets, not as tests:**
  - time to skeleton, before and after
  - render counts with and without the React Compiler
  - image size and build time with and without standalone output
  - the precache analysis
- Ticket 12 adds no new tests. The isolated linker and the extended import check are the checks, and the E2E harness boots the source the way production does. The two db tests it moves into api run in a gate for the first time.
- Every commit passes the `CONTRIBUTING.md` gates plus `pnpm deps:cycles` and `pnpm format:check`. E2E runs against a fresh `pnpm build`.

## Out of Scope

- Better Auth 1.7, account linking and anything else in the auth package beyond the session check's placement. Better Auth 1.7 landed in the sweep.
- The six defects fixed on `chore/dependency-upgrades` before this spec starts (see Further Notes).
- Client-side caching and Redis auto-pipelining. RESP3 itself lands in the dependency sweep (ticket 34).
- Deduplication for enrichment.
- BullMQ flows, global concurrency and rate limits, telemetry, metrics and sandboxed processors. Norish runs as one process.
- BullMQ 6's typed progress. It never reaches the Queue getters the job monitor reads, so the runtime check of stored progress stays.
- Moving the locale into the URL, `experimental.useOffline`, `after()` in tRPC procedures, server-side prefetching with hydration boundaries (ADR-0001), `forbidden()`, `typedRoutes`, and dropping the custom server, which the tRPC WebSocket still needs.
- Stripping the existing memo hooks, and route cross-fades.
- Next 17 itself, which is not released (npm `latest` is 16.4.0 on 2026-10-14).
- Cancelling waiting or delayed jobs, which the job monitor's existing actions already cover.
- Node's own type stripping in place of tsx, and a CI step that boots the image. The reasons are under Installs, the server build and the image.
- These image cuts were measured but not planned:
  - **yt-dlp:** a 39 MB binary carrying its own Python. Installing it into a venv on the shipped Python would need a `curl_cffi` wheel for Python 3.15 on musl.
  - **A minimal ffmpeg:** most of its 48 MB compressed is codecs Norish never uses, but trimming it means building ffmpeg ourselves.
  - **A hand-built base image:** saves 7 MB and gives up free base-image updates.

## Further Notes

- **What lands first, on `chore/dependency-upgrades`.** One fix commit each, with a test. Ticketed there on 2026-10-14 as 51 to 56 (the reconnect half of fix 3 is in 34):
  1. `drainDelay` is in seconds, not milliseconds, so idle workers stop blocking for 83 minutes.
  2. The Redis publisher is created once and not replaced while it reconnects (`maxRetriesPerRequest: 1`), which ends the connection leak during outages.
  3. The BullMQ client never gives up reconnecting, and a Redis `PING` joins the health check. The reconnect half comes with the sweep's ticket 34, which drops the hand-rolled retry strategy for ioredis 6's never-give-up default.
  4. An idempotency claim is taken with a five-minute TTL and extended to seven days on completion.
  5. Every Queue and QueueEvents gets an `error` listener.
  6. The proxy matcher anchors its prefixes, so a future `/login-history` isn't public.
- **The sweep's ticket 17** lists two "improvements BullMQ already supports" that do not hold:
  - Deduplicating enrichment would break its status read and automatic-run merging.
  - Passing the signal does nothing while the wrappers take two parameters, and `close()` never aborts running jobs.
  - This spec supersedes both.
- **Order.**
  - `createWorker` comes first; deduplication (because of CalDAV's delay), cancellation and retention build on it.
  - The proxy change lands before the Cache Components baseline is measured.
  - Ticket 12 lands before 07 and 13. Ticket 07 builds on the server's new start command, and 13's cuts are measured against 12's image.
  - Everything else is independent. The health endpoints (ticket 11) need only the sweep merged, because ready reuses its ticket 53 Redis ping.
- **Release notes.**
  - Features: administrators can cancel a running background job.
  - Fixes and Improvements:
    - Background jobs and realtime recover by themselves after a Redis restart. The sweep's ticket 35 writes this line.
    - Ticket 01 writes: "A recipe import or calendar sync that failed and is due to retry now retries as soon as its wait is over. Before, the retry did not run until another import or sync was started, even after a restart." The maintainer will rewrite it.
  - Ticket 13 writes, under Fixes and Improvements: "The Docker image is about 30% smaller to download."
  - Ticket 12 writes, under Upgrade notes: "The image starts the server with `node --import tsx /app/apps/web/server/index.ts`. If you override the container's command, update it."
  - Upgrade notes: two new health endpoints. `/api/v1/health/live` is for restarts, `/api/v1/health/ready` is for traffic, and the image's healthcheck now calls live. `/api/v1/health` is removed; point a probe that called it at live or ready. Ticket 11 writes this.
  - The rest is internal and stays unpublished (ADR-0010).
- **Docs.** The admin settings page documents cancelling a job, with a screenshot.
- **Mobile.** Hoisting arrived with the Expo app, which has since left the workspace.
  - A rewrite that rejoins the workspace works isolated: Expo supports isolated installs since SDK 54, and configures Metro for monorepos itself since SDK 55.
  - The rewrite's real constraint is React's version, not the linker. The workspace is on 19.3, while Expo pins 19.2, and that splits React Query's context under either linker.
