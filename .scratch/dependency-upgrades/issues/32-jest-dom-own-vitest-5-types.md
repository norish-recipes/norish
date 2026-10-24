# 32 — jest-dom's own Vitest 5 types

Status: resolved
Blocked by: a jest-dom release carrying testing-library/jest-dom#742
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

`apps/web/__tests__/jest-dom-vitest.d.ts` declares jest-dom's matchers on Vitest's `Matchers` interface.

**Why it exists:**

- jest-dom 7.0.1 (npm `latest` on 2026-10-13) still augments Vitest 4's `Assertion<T>`.
- Vitest 5 declares `Assertion<R, T>`, so the two declarations can't merge. This is upstream issue testing-library/jest-dom#738.
- `skipLibCheck` hides the failed merge, so without the local file the matchers are silently untyped.
- The fix is upstream PR testing-library/jest-dom#742, "feat: support vitest 5". It was still open on 2026-10-13.

**When a jest-dom release carries #742:**

1. Take that release.
2. Replace the `matchers` import and `expect.extend` in `apps/web/__tests__/setup.ts` with `import "@testing-library/jest-dom/vitest"`.
3. Delete the shim.

The review said the shim misses `AsymmetricMatchersContaining`. That is wrong: in Vitest 5 that interface extends `Matchers`, so the shim already covers it.

## Acceptance criteria

- [ ] `jest-dom-vitest.d.ts` is gone.
- [ ] `pnpm typecheck` passes, and a misspelled matcher such as `toBeInTheDocumen` is a type error.

## Comments

- Filed 2026-10-13 from the branch review. Blocked on upstream; check the jest-dom releases before starting.
- 2026-10-14 — Still blocked: jest-dom `latest` is 7.0.1 and #742 is open. It does not hold the branch's PR; if no release carries #742 by then, the shim ships and this ticket moves to the next release.
- 2026-10-14 (later) — Checked again while implementing 31–56: jest-dom `latest` is still 7.0.1 and testing-library/jest-dom#742 is still open. As agreed above, the shim ships with 0.26 and this ticket carries over to the next release.
- 2026-10-14 — Closed by the maintainer. The shim ships with 0.26 and its criteria stay unticked: jest-dom `latest` is still 7.0.1 and #742 is open. When a release carries #742, the three steps above still apply.
- 2026-10-15 — Listed under the spec's Held lines, so the open criteria have a home after this ticket closes.
