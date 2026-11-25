# 01: Child processes get an allowlisted environment

**What to build:** Every process Norish starts receives only the variables it needs, never `MASTER_KEY`, `DATABASE_URL`, OAuth client secrets or `AI_API_KEY`. See the spec, "Child processes".

**Blocked by:** none

**Status:** ready-for-agent

- [ ] **Helper:** one function in `packages/shared-server` returning the allowlisted env plus caller-named extras.
- [ ] **Every call site:** `embedded-parser.ts` (adds `PARSER_API_PARENT_PID`), `media/storage.ts` (ffprobe and ffmpeg), `media/ffmpeg.ts`, `ai/runtime/wav-copy.ts`, `video/yt-dlp-version.ts`, `packages/api/src/video/yt-dlp.ts`. No `spawn`/`execFile`/`execSync` is left without it.
- [ ] **Still works:** a URL import through the parser, a yt-dlp video import and ffmpeg transcoding run as before, including behind `HTTPS_PROXY`.
- [ ] **Tests:** a spawned child sees `PATH` and a caller extra, and does not see `MASTER_KEY` or `DATABASE_URL`.
- [ ] Its own commit, landing before ticket 02.
