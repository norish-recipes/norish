# 49 — Open checks on resolved tickets

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

These tickets are resolved but still have unticked criteria that an agent can close. Tick each box in its own ticket once done.

- **16, Reproducible.** Compare two image builds of the same commit, made a day apart. Their `node_modules` versions are identical.
- **16, pnpm 12 everywhere.** `pnpm install --frozen-lockfile` passes on pnpm 12 in CI and in the devcontainer.
  - CI's frozen install is blocked by `minimumReleaseAge` until about 2026-10-14 18:15 (71af9042).
- **18, Production smoke.** The E2E suite covered the rest; the part never watched is a scheduled task firing. On a production build, see one fire.

**Covered elsewhere:**

- Ticket 20's env-loading check is in 45.
- Ticket 22's deploy run is in 44.
- Ticket 12 is in 47, and ticket 25 in 48.
- The hand checks are in 50.

Ticket 24's "Warm idle" is dropped: `.scratch/architecture-after-upgrades/` ticket 01 deletes the lazy-worker manager, warm-idle shutdown included.

Tickets 17 "Upgraded instance" and 18 "Boot twice" stay as they are: the maintainer decided the tests start from Job Schedulers, not from a hand-built 5.x repeatable.

## Acceptance criteria

- [x] Each check above is done and ticked in its ticket, with what was observed in that ticket's comments.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Ticket 24's Warm idle check removed; the maintainer confirmed the lazy workers go (architecture ticket 01).
- 2026-10-14 (worked) — **18, Production smoke: done**, ticked in 18 (a Job Scheduler run fired on the production image). **16, pnpm 12 everywhere:** devcontainer and Docker pass; CI waits for the branch to be pushed after the release-age block lifts (~18:15 CEST). **16, Reproducible:** two builds an hour apart from the same lockfile are identical, but not a day apart. Both stay open in 16 with what was seen. Status stays `ready-for-agent` until those two close.
- 2026-10-14 — Closed by the maintainer; ticket 16's two remaining boxes are ticked there.
