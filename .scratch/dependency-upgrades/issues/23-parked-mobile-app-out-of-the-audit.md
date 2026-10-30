# 23 — The parked mobile app stops counting against the audit

Status: resolved
Blocked by: 25 (type checking)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

84 of the 181 advisories in the audit sit only in apps/mobile's Expo, Metro and React Native tooling, including:

- shell-quote (critical);
- @xmldom/xmldom, svgo, ws 7, node-forge, braces, compression and image-size;
- uuid 7, decode-uri-component and nanoid 3.

**None of it ships.** The image deploys only `@norish/web`'s production dependencies.

**But it still costs something:**

- The Expo cluster is linked into `packages/auth` through `@better-auth/expo`'s optional peers.
- It keeps every audit noisy.
- It makes every audit read worse than the shipped product is.

The Expo SDK 56 → 57 upgrade belongs to the mobile rewrite, not to this effort.

**Decision (2026-10-13): take apps/mobile out of the pnpm workspace, and stop mounting its server plugin.**

- Add `"!apps/mobile"` to `pnpm-workspace.yaml`, as apps/docs already is, and re-lock from scratch. A lockfile-only install keeps the stale Expo peers, so the full re-lock is needed.
- apps/mobile keeps its own install: `pnpm install --ignore-workspace` inside it, and `pnpm dev:mobile` still starts it. Its `@norish/*` imports must still resolve; if they come through the workspace today, point them at the packages with `link:` paths.
- Remove `expo()` from `packages/auth/src/auth.ts` and drop `@better-auth/expo` from the server. No production server then exposes the Expo authorization proxy, which has no user while the app is parked. The rewrite adds it back.
- Afterwards the only non-mobile finding expected is braces, via `@next/eslint-plugin-next` › fast-glob: dev-only, with no fix (ticket 03 records it).

## Acceptance criteria (once decided)

- [ ] **Audit.** `pnpm audit` no longer lists the Expo cluster.
- [ ] **Server.** `pnpm why @better-auth/expo` prints nothing outside apps/mobile, and the auth tests pass without `expo()`.
- [ ] **Docs.** `AGENTS.md`'s apps/mobile note and `CONTRIBUTING.md` say how to install and start the parked app, and `pnpm dev:mobile` still starts it.
- [ ] **Gates.** The repo gates pass.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-13 — The maintainer chose option 3 and dropping `expo()` for now.
- 2026-10-13 — Done. apps/mobile is outside the workspace with its own `pnpm-lock.yaml`; its `catalog:` entries are pinned to the versions the catalog held, and its `@norish/*` packages use `link:`. `pnpm dev:mobile` starts Metro. The server no longer mounts `expo()` or trusts `mobile://`/`exp://` origins. Taking it out exposed a hidden dependency: apps/web's tests used `@testing-library/user-event`, which only expo-router pulled in; apps/web now declares it. `pnpm audit` on the workspace: 130 findings (44 high, 70 moderate, 16 low), none from Expo.
