# 11: Liveness and readiness endpoints, replacing `/health`

**What to build:**

- An orchestrator restarts Norish only when a restart would help, never through a Postgres or Redis outage.
- A load balancer stops sending traffic while Postgres or Redis is down, and sends it again once they are back. A parser outage stops URL imports, not the whole app.
- An operator whose probes call `/api/v1/health` learns from the Upgrade notes what replaces it.

See `.scratch/architecture-after-upgrades/spec.md`, Health checks.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged, so ready can reuse the sweep's ticket 53 Redis ping.

**Status:** ready-for-agent

- [x] Two tRPC OpenAPI procedures sit beside `health` in `packages/trpc/src/routers/config/procedures.ts`, under the Health tag, with `protect: false`:
  - [x] `GET /api/v1/health/live` answers 200 while the process responds and the parser answers its health check, and 503 when the parser doesn't. It checks no Postgres and no Redis. (Norish runs the parser itself, so a restart fixes a hung one.)
  - [x] `GET /api/v1/health/ready` answers 503 when Postgres or Redis fails, and 200 otherwise. The parser's state is in the body and never fails the check.
- [x] `GET /api/v1/health` is removed and answers 404 (changed 2026-10-15; it was first kept as deprecated).
- [x] The image's `HEALTHCHECK` and `docker/docker-compose.example.yml` call live.
- [x] `docker/docker-compose.test.yml` and the E2E harness (`apps/web/__tests__/e2e/harness/production-stack.ts`) call ready. Where the harness needs the parser, it checks the parser's own health.
- [x] The health tests (`packages/trpc/__tests__/openapi/health.test.ts`) cover:
  - [x] live fails on a parser that doesn't answer, and stays 200 with Postgres or Redis down
  - [x] ready fails on Postgres or Redis, and stays 200 with the parser down
  - [x] `/health` answers 404
- [x] `openapi.json` is regenerated, so the docs' API reference shows both endpoints and no `/health`.
- [x] The image builds and boots: its healthcheck reports healthy, and stays healthy with Redis stopped.
- [x] Release notes, under Upgrade notes: `/api/v1/health/live` is for restarts and `/api/v1/health/ready` is for traffic (Kubernetes readiness probes, load balancers), and the image's healthcheck now calls live. `/api/v1/health` is removed; point a probe that called it at live or ready.

## Comments

- 2026-10-14, implemented:
  - `healthLive` and `healthReady` sit beside `health` in `config/procedures.ts`, and are listed in `openApiRouter` (`src/openapi.ts`), since that router, not the config router, is what the REST paths are served from. The parser check moved into one `getParserHealth()`, which all three use.
  - **Beyond the ticket: the web app's own connectivity probe now calls ready.** `HEALTH_PROBE_PATH` (`apps/web/lib/connectivity/probe.ts`) used `/api/v1/health`, so a parser outage turned the whole app Offline, and removing the deprecated endpoint would later break it. Live in the app means Postgres and Redis answer. The parked mobile app still calls `/api/v1/health`; it is out of reach until its rewrite.
  - The E2E harness waits for ready and for the embedded parser's own `/health` on its port, since URL-import specs need the parser and ready no longer waits for it.
  - The README's compose snippet calls live, like the example compose.
  - Docs: a "Health checks" table on the Server & runtime page, which the Upgrade note links to.
  - **Still open:** the image boot check (healthy, and still healthy with Redis stopped). The Dockerfile changes again in ticket 12, so it is verified with that image.
- 2026-10-14. **Image boot check done** on arm64 and amd64 (the final image, with tickets 07 and 13): the healthcheck reports healthy, and stays healthy with Redis stopped while `/api/v1/health/ready` answers 503.
- 2026-10-15, from the branch review:
  - **`/api/v1/health` is removed.** The maintainer ruled out keeping compat code in 0.26, so the deprecated endpoint, its `getServiceHealth` and its response schema are gone, and `/health` answers 404. The Upgrade note says to point a probe that called it at live or ready. User story 50 is answered by that note instead of by the endpoint.
  - **Ready waits on the parser two seconds at most.** It reused the parser's 15-second request timeout, so a hung parser held ready past any probe's timeout, and the app's connectivity probe (5 s) showed Offline: the outage this ticket set out to contain. Live keeps the longer wait, so a parser busy with a big page doesn't get Norish restarted. A test spies the timeout ready passes.
