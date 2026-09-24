# 09 — ADRs accepted, glossary settled, the WebSocket configuration page, release notes

**What to build:** the paperwork that makes the rebuild a recorded decision and a documented feature.

- Flip the three entries for ADR-0032, ADR-0033 and ADR-0034 in `docs/adr/index.html` from **Proposed.** to **Accepted.**; re-read the ADR bodies in `docs/adr/realtime/` against what shipped and correct any detail that drifted (bounds, close codes, file names).
- Re-read the `### Realtime` section of `CONTEXT.md` against the code; every term must name something that exists.
- Write `apps/docs/docs/configuration/websocket.md`: the endpoint (`/trpc` upgrade on the HTTP port; only subscriptions use it); reverse-proxy examples for nginx (`proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_read_timeout 60s;`), Caddy (`reverse_proxy` handles it by default) and Traefik (no extra configuration), with the rule that any idle timeout must exceed 25 s because the server pings every 20 s and waits 5 s for the pong; the Origin check and `TRUSTED_ORIGINS`; the close codes (`1012` restart, `4000` scope change, `4401` sign in again); Redis expectations (the connection count is independent of connected clients; `norish:stream:*` keys hold about a thousand recent events per channel for a day); troubleshooting (the banner line, the `realtime.reconnected` log). Link it from `apps/docs/docs/configuration/server-runtime.md` beside `REDIS_URL`.
- Release notes for the Target Version (`apps/docs/docs/release-notes/<target>.md`, per `docs/agents/feature-docs.md`): under Fixes and Improvements, one bullet for missed events arriving after a reconnect and one for the faster restart; under Upgrade notes, the Origin check (an operator whose proxy rewrites `Origin` must list the public origin in `TRUSTED_ORIGINS`) and that the mobile app is parked and unsupported on this release until its rewrite ships.
- `pnpm format` and `pnpm build` inside `apps/docs` (a standalone workspace).

**Blocked by:** 07, 08.

**Spec:** `.scratch/realtime-foundation/spec.md` § Release shape

**Status:** ready-for-human

- [x] Index entries read **Accepted.**; ADR bodies match the shipped code
- [x] `CONTEXT.md` `### Realtime` verified against the code
- [x] `websocket.md` in the docs sidebar; `server-runtime.md` links it
- [x] Release notes updated: two improvement bullets, two upgrade notes
- [x] `pnpm format` and `pnpm build` in `apps/docs` green; the four root gates green

## Comments

- Implemented on `rc/0.24.0-beta` (2026-09-21).
  - ADR-0032, ADR-0033 and ADR-0034 are **Accepted** in `docs/adr/index.html`. Two details had drifted and are corrected in the bodies and the glossary: an **admin transfer is not a Scope Change** (the household key does not change, and `transferAdmin` never publishes `connection.invalidate` — only create, join, leave, kick and account deletion do), and the Resume Buffer key is the channel with its `norish:` prefix *replaced* by `norish:stream:`, not `norish:stream:<channel>`. Everything else in the three ADRs and in `CONTEXT.md` § Realtime names something that exists (`CURSOR_MARK`, `RealtimeLaggedError` and its six reasons, `RESUME_MAXLEN = 1000`, `RESUME_TTL_SECONDS = 86400`, the 4000/4401/1012 codes).
  - `apps/docs/docs/configuration/websocket.md` is the new page (endpoint, nginx/Caddy/Traefik, the 25 s rule, the Origin check, close codes, Redis expectations, troubleshooting); `server-runtime.md` links it beside `REDIS_URL` and under `TRUSTED_ORIGINS`.
  - The docs checkpoint was due (`v0.23.1-beta` is tagged and `docs/` still carried its label), so `pnpm docs_update 0.24.0-beta` ran first, then `release-notes/0.24.0-beta.md` was written (release-notes positions renumbered). The docs format gate was already red on seven untouched pages (trailing whitespace in `site-authentication.md`, `aisles.md`, `0.23.1-beta.md` and their frozen copies); they are formatted in the checkpoint commit so the gate is green.
  - No new user-facing strings; `pnpm i18n:check` unaffected.
