# 01 — The tree is clean and the gates hold

**What to build:** A contributor who breaks formatting sees the board go red, and a red board
means something is actually broken. Today the Format Check gate runs Prettier in write mode
against a throwaway CI checkout, so it has never been able to fail and roughly 1,500 lines of
drift accumulated behind it; the Tests gate is genuinely red because a workflow-wide
production environment overrides the value Vitest needs.

**Blocked by:** None — can start immediately.

**Spec:** `.scratch/import-and-provider-fixes/spec.md`

**Status:** ready-for-agent

Note the working tree is dirty and is the starting state, not the target. The formatting churn
is already written; this ticket reverts one part of it, lands the rest, and makes the gate
enforce.

- [x] Generated Drizzle migration metadata is excluded from formatting, and the reformatting of
      it already in the tree is reverted — five snapshots and the journal. The generator does
      not write Prettier-shaped output, so without this every schema generation reddens the
      board.
- [x] The remaining formatting churn lands and the whole repo passes the format check.
- [x] The quality-checks workflow runs the check script that already exists rather than the
      write script, so Format Check can fail. Verify by breaking a file locally and watching
      the check go red — do not take a green run as evidence.
- [x] The Tests gate runs under the environment Vitest expects and is green. It currently fails
      with a missing built-in module error because the workflow-wide production setting makes
      Vite resolve Node builtins as browser externals.
- [x] The unterminated admonition on the AI provider configuration page is closed. The docs
      build passes either way, so confirm against the rendered output: today the whole page
      body from Recipe Enrichment down renders inside one note callout.
- [x] The revert, the churn, and the gate switch are separate commits in the same PR.

## Comments

**Done.** Five commits: `1a0e8f17` (metadata exclusion), `0f46a944` (landing formatter scope),
`e4685fb1` (churn), `e6013721` (gate switch), `83365ed3` (review fixes).

Evidence, not green runs:

- Format gate: with a misformatted file in the tree, `pnpm run format:check` exits 1 and names
  it; `pnpm run format` exits 0 and silently rewrites it. The old gate could never fail.
- Tests gate: `NODE_ENV=production` → 28 of 105 web suites die with "No such built-in module:
  node:". `NODE_ENV=test` → 105 files, 684 tests pass.
- Admonition: measured in the rendered DOM. Unclosed, one `.theme-admonition` holds 5,625
  characters and three `h2`s (Recipe Enrichment, Video import, Transcription). Closed, it holds
  135 characters and none.

Two things worth knowing downstream:

- **Ticket 06** — the parent spec asked for the workflow invariant to extend
  `packages/config/__tests__/config/yt-dlp-version.test.ts`. That file is untracked ticket-06
  work importing `DEFAULT_YT_DLP_VERSION`, which does not exist at HEAD, so extending it would
  have made ticket 01 (blocked by nothing) depend on ticket 06. It went into
  `quality-gates.test.ts` instead — same package, same seam, same grep pattern. Merge the two
  when 06 lands if you want them in one file.
- **Ticket 07** — the admonition fix is in the working tree, not in a commit: the breakage was
  only ever uncommitted, so closing it means the rewrite you land already has the closing
  `:::`. Don't drop it. Everything else in `ai-provider.md`'s diff is still yours.

One change beyond the checklist: `apps/landing` gained `--ignore-path .gitignore` (`0f46a944`),
because the root `.gitignore` anchors `/out/` to the repo root, so the formatter walked — and
`pnpm run format` rewrote — 52 build artefacts. Mirrors what `apps/docs` already does.
