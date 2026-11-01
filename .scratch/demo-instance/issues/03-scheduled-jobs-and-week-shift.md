# 03: No nightly jobs, and the demo week follows today

**What to build:** on a Demo Instance the scheduled-task producer (`packages/queue/src/scheduled-tasks/`) schedules none of the nightly jobs and skips the boot-time catalogue refresh. Boot-time migrations and upgrades still run, since that is how the dump reaches a new release.

In their place, one demo-only task moves planned items and recurring-grocery dates (`next_planned_for`, `last_checked_date`) forward by whole weeks until the latest planned week is the current week. It is idempotent, keeps weekdays, stores no anchor, and runs on boot and nightly. It writes through repositories.

See `.scratch/demo-instance/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Repository test: a plan three weeks old lands on this week with the same weekdays; running again changes nothing
- [ ] Test: under the flag no nightly job is scheduled and the shift task is
- [ ] Gates green: lint, typecheck, test:run, i18n:check, build
