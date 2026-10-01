# 07: Monthly rebuild workflow

**What to build:** A scheduled GitHub workflow runs the build script every month and opens a pull request when the source table changed, so new dataset editions, taxonomy codes and name matches reach the repo without anyone remembering to run it. A failed run (a dataset host down, a moved download link) just fails, and the next month's run tries again. It never blocks a release.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] The workflow runs monthly and on manual dispatch.
- [x] An unchanged result opens no pull request; a changed one opens or updates a single pull request whose diff shows what changed.
- [x] A failure leaves the committed table untouched and gates nothing else.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented as `.github/workflows/nutrition-sources.yml`: monthly (the 3rd, 05:17 UTC) and on manual dispatch, from the default branch. The script writes the table only when its version changes, and the workflow opens a pull request only when the file differs. A changed table is force-pushed to the one branch `chore/nutrition-source-table`, and an open pull request for it is updated rather than duplicated. A failed download or build fails the run before anything is pushed.
- Not run on GitHub yet: its first real run is the first scheduled one after this lands, or a manual dispatch. The pull request is opened with the workflow's own token, so PR Quality does not run on it until someone pushes to the branch. The body says so; a PAT secret would change that, and is Mike's call.
