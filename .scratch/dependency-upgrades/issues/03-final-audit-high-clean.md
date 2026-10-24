# 03 — The final audit comes back high-clean

Status: wontfix
Blocked by: every other 0.26 ticket in this plan
Target release: 0.26.0-beta (the last commit on the branch)

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

The 0.25 floors below were never applied. After the sweep most of them are moot, because their parents move to releases that already require patched versions. So this ticket runs last:

1. `pnpm audit --audit-level=high` in the workspace, and inside `apps/docs`.
2. For every high or critical finding that remains, bump its parent first. Only when the parent has no fixed release, add a **range-selector override** in `pnpm-workspace.yaml` that moves the vulnerable range to the smallest patched release inside its major, with a comment naming the parent that needs it.
3. The zod override stays as a single-copy pin (ticket 08); the other existing overrides stay only if `pnpm why` still shows two copies without them.
4. Anything that cannot be fixed (no release exists, such as braces) is listed in the comments with its path and whether it ships.

The floor list researched on 2026-10-12 is a starting point, not a target:

```yaml
"@babel/core@<7.29.6": ^7.29.6
"@grpc/grpc-js@>=1.14.0 <1.14.5": ^1.14.5
"@humanfs/node@<0.16.8": ^0.16.8
"baseline-browser-mapping@<2.11.0": ^2.11.0
"brace-expansion@<1.1.21": ^1.1.21
"brace-expansion@>=2.0.0 <2.1.7": ^2.1.7
"browserslist@<4.28.7": ^4.28.7
"fast-copy@>=4.0.0 <4.1.0": ^4.1.0
"js-yaml@>=4.0.0 <4.3.2": ^4.3.2
"lodash@<4.18.0": ^4.18.0
"qs@<6.16.0": ^6.16.0
"source-map-js@<1.2.2": ^1.2.2
```

protobufjs, @protobufjs/utf8 and sharp were cleared in 0.25; nanoid 5 left with Scalar; undici moves to 8 (ticket 15).

## Notes

**Where each finding comes from, and whether it ships:**

| Package                                                            | Path                                                   | Ships in the image?                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| protobufjs, @protobufjs/utf8, @grpc/grpc-js                        | testcontainers › dockerode (dev)                       | No                                                                                                                                |
| undici 7.29.0                                                      | shared-server (direct)                                 | **Yes.** Inlined into `dist-server` by tsdown (the AI transport's `Agent`), plus a nested copy that `COPY /app/packages/` carries |
| undici 7.24.6                                                      | api › cheerio 1.2.0 (latest, `^7.19.0`)                | Build and CI only                                                                                                                 |
| undici 8.10.0                                                      | testcontainers, jsdom (dev)                            | No                                                                                                                                |
| nanoid 5.1.11                                                      | web › `@scalar/nextjs-api-reference` › `@scalar/types` | **Yes**, in the `/api/docs` chunk                                                                                                 |
| qs 6.15.0                                                          | trpc › trpc-to-openapi 3.3.0 › co-body                 | Bundled, but unreachable: the fetch adapter parses bodies itself                                                                  |
| fast-copy 4.0.2                                                    | shared-server › pino-pretty                            | External; the image re-resolves it                                                                                                |
| lodash 4.17.23, brace-expansion 2.0.3                              | shared-server › archiver 7 › archiver-utils            | **Yes**, inlined with archiver (archiver 8 drops both; ticket 20)                                                                 |
| js-yaml, brace-expansion 1.x, @humanfs/node                        | eslint and its config tooling                          | No                                                                                                                                |
| source-map-js, browserslist, baseline-browser-mapping, @babel/core | next › postcss / styled-jsx                            | Build time only                                                                                                                   |

**The image does not install from the lockfile.**

- `pnpm deploy --legacy` (`docker/Dockerfile`) prints "A pnpm-lock.yaml file exists. The current configuration prohibits to read or write a lockfile." It re-resolves every dependency from its semver range on each image build. This was reproduced in a scratch deploy.
- It does honour `overrides`, so these floors protect the image as well.
- Lockfile versions still reach the image in three ways:
  - modules tsdown inlines into `dist-server`;
  - modules Next bundles into its server chunks;
  - nested `packages/*/node_modules` copied in by `COPY /app/packages/`.
- Ticket 16 fixes the root cause.

**Untouched here.** The Expo tooling cluster (ticket 23) stays as it is.

## Acceptance criteria

- [ ] **Audit.** `pnpm audit --audit-level=high` exits 0 in the workspace and in apps/docs, or every remaining entry is listed in the comments with its reason.
- [ ] **Overrides.** Every override has a comment naming the parent that still needs it.
- [ ] **Image.** The deployed tree in a production Docker build (`node_modules/.pnpm/lock.yaml`) shows the patched versions.
- [ ] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes.

## Comments

- Filed 2026-10-12 with the spec as "Transitive advisories get security floors" for 0.25; not applied in 0.25.
- 2026-10-13 — Repurposed as the sweep's last step: fix by upgrade first, override only what remains (the approach of `.scratch/dependency-security/` ticket 09). The table under Notes describes the lockfile of 2026-10-12.
- 2026-10-14 — Marked wontfix so agents skip it; the maintainer still does this by hand.
