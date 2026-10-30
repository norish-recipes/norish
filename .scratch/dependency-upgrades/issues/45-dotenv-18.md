# 45 — dotenv 18

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 20. Found in the branch review on 2026-10-13.

## What to build

Ticket 20 held dotenv at 17.4.2 until 18 "has gone about two weeks without a patch". That is not one of the spec's reasons to hold a line, which are "no stable release" or "another package's peer range rejects it".

1. Take dotenv 18.0.x in `packages/config`.
2. ~~Remove dotenv from the spec's held lines.~~ Done on 2026-10-14 with the plan fix.
3. Ticket 20's open env-loading criterion belongs here: one test with a `.env` file, and one with the variables set in the process environment.

## Acceptance criteria

- [x] `packages/config` is on dotenv 18.
- [x] Both env-loading tests pass.
- [x] dotenv is gone from the spec's held lines.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — The maintainer confirmed taking dotenv 18; the held line is gone from the spec.
- 2026-10-14 (implemented) — dotenv 18.0.7 (published 2026-10-09). `packages/config/__tests__/config/env-loading.test.ts` re-imports `env-config-server` from a temporary `apps/web` directory: a `.env.local` one level up is read, a variable set in the process environment wins over the file, and the process environment alone works without a file. All three passed on 17.4.2 before the bump and on 18.0.7 after; the config suite passes (815). The full E2E pass at the end of this batch boots the server bundle on it.
