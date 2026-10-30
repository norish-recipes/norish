# 36 — Next and Turborepo agent checks back on

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md` decision 9. Found in the branch review on 2026-10-13.

## What to build

Three settings switch the coding-agent checks off:

- `experimental.agentUpgrade: false` in `apps/web/next.config.js:66` and `apps/landing/next.config.ts:29`. The comment says that otherwise `next build` fails under a coding agent whenever the installed Next has an advisory.
- `"agentGuidance": false` in `turbo.json:3`. It arrived with the lockfile refresh (3dae889c), and no ticket asked for it.

The maintainer wants them on. A build that stops because Next has an advisory is the signal to upgrade Next.

1. Remove the three settings and their comments.
2. Record in this ticket what each check does on the current versions, so the next agent knows what to expect.
3. ~~Update spec decision 9.~~ Done on 2026-10-14 with the plan fix.

## Acceptance criteria

- [x] None of the three settings remain.
- [ ] `pnpm build` passes both from a coding agent and in CI.
- [x] Spec decision 9 says the checks are on.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer thinks the checks can be on.
- 2026-10-14 — The maintainer confirmed the reversal; spec decision 9 now says the checks are on.
- 2026-10-14 (implemented) — `experimental.agentUpgrade: false` is gone from both Next configs and `"agentGuidance": false` from `turbo.json`, with their comments. What each check does on the installed versions:
  - **Next 16.4.0, `agentUpgrade`** (default `'security'`). `next build` and `next dev` load the upgrade nudge. When a coding agent is detected (`CLAUDECODE`, `AI_AGENT` and the like) and the installed Next has a known advisory, the command stops once with an upgrade recommendation and the `next upgrade --agent=security` command to run; a retry of the same command continues. With no agent detected, a build returns from the nudge at once (`nudge.js`: no signal, no prompt), so CI is untouched. On 16.4.0 there is no advisory: `pnpm run build:web` from this agent session printed nothing and passed.
  - **Turborepo 2.11.7, `agentGuidance`** (default `true`). When an agent is detected, every repository-scoped `turbo` command writes or refreshes a marked block in the root `AGENTS.md` that points agents at the docs bundled with the installed `turbo` (`node_modules/turbo/docs/reference/configuration.mdx`). It appeared on the first `turbo run build:server` from this session. Turbo's docs say to keep the block committed, or every agent run leaves an uncommitted change, so it is committed with this ticket. It is written by turbo, not by hand: edit it and turbo writes it back. **For the maintainer:** this is the one visible cost of having the check on.
  - `pnpm build` in CI is left for the PR's own run.
- 2026-10-14 (review fixes) — `pnpm build` passes from a coding agent again on the review fixes. The CI half ticks on the branch's first CI run after the push.
