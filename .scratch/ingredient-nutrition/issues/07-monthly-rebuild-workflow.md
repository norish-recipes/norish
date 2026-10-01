# 07: Monthly rebuild workflow

**What to build:** A scheduled GitHub workflow runs the build script every month and opens a pull request when the source table changed, so new dataset editions, taxonomy codes and name matches reach the repo without anyone remembering to run it. A failed run (a dataset host down, a moved download link) just fails, and the next month's run tries again. It never blocks a release.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The workflow runs monthly and on manual dispatch.
- [ ] An unchanged result opens no pull request; a changed one opens or updates a single pull request whose diff shows what changed.
- [ ] A failure leaves the committed table untouched and gates nothing else.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
