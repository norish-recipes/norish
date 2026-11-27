# 01: Child processes get an allowlisted environment

**What to build:** Every process Norish starts receives only the variables it needs, never `MASTER_KEY`, `DATABASE_URL`, OAuth client secrets or `AI_API_KEY`. See the spec, "Child processes".

**Blocked by:** none

**Status:** done

- [x] **Helper:** one function in `packages/shared-server` returning the allowlisted env plus caller-named extras.
- [x] **Every call site:** `embedded-parser.ts` (adds `PARSER_API_PARENT_PID`), `media/storage.ts` (ffprobe and ffmpeg), `media/ffmpeg.ts`, `ai/runtime/wav-copy.ts`, `video/yt-dlp-version.ts`, `packages/api/src/video/yt-dlp.ts`. No `spawn`/`execFile`/`execSync` is left without it.
- [x] **Still works:** a URL import through the parser, a yt-dlp video import and ffmpeg transcoding run as before, including behind `HTTPS_PROXY`.
- [x] **Tests:** a spawned child sees `PATH` and a caller extra, and does not see `MASTER_KEY` or `DATABASE_URL`.
- [x] Its own commit, landing before ticket 02.

## Comments

- Helper is `childEnv(extra)` in `packages/shared-server/src/lib/child-env.ts` (export `./lib/child-env`). It copies `process.env` and deletes what isn't allowlisted, because apps/web and Next augment `NodeJS.ProcessEnv` with required keys a built-up object can't satisfy without a cast.
- Sweep beyond the list found no other runtime spawns: playwright-core only `connectOverCDP`s, BullMQ processors and pino run in-process, restart is `process.exit`. Left alone: test harnesses, `tooling/monorepo/scripts/*` and `apps/web/scripts/measure-*` (dev tools on the developer's own env).
- "Still works" was verified live, not in E2E: real parser start + `/parse` (child env checked with `ps -E`: no `MASTER_KEY`/`DATABASE_URL`/`AI_API_KEY`), `convertToMp4` transcode, WAV copy, `yt-dlp --version`, and `yt-dlp --dump-json` tunnelled through a local `HTTPS_PROXY`.
- No lint guard against a future spawn without `childEnv`; reviewers catch it for now.

### Review (4b815ed45..HEAD)

- **fix** Standards 2: `ALLOWED` renamed `ALLOWED_NAMES` (gatekeeper commit).
- **fix, in ticket 04's docs pass** Standards 6: an upgrade note and release-notes line that child processes (yt-dlp, ffmpeg, the parser) no longer inherit Norish's environment.
- **reject** Standards 1 (`env: childEnv()` at each spawn): the reviewer's own verdict is that a wrapper would be a Middle Man.
- **reject** Standards 5 / Spec (c), Windows names (`Path`, `SystemRoot`): Norish ships as a Linux image and the embedded parser already hard-codes `.venv/bin/python`; the spec's list is explicit.
- **reject** Spec (a), no automated "Still works" test: the ticket's Tests box asks for the spawned-child test only; the flows were run live (above) and the final E2E pass covers imports.
- **ask** Standards 5 / Spec (d): should the allowlist also carry the CA-bundle variables (`SSL_CERT_FILE`, `SSL_CERT_DIR`, `REQUESTS_CA_BUNDLE`, `CURL_CA_BUNDLE`, `NODE_EXTRA_CA_CERTS`) and `ALL_PROXY`/`all_proxy`? They used to reach yt-dlp and the parser and now don't. Not in the spec's list; blocks nothing.
