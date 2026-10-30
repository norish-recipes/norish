# eslint-plugin-sonarjs, on SonarQube's default profile

Status: resolved

Decided with the maintainer on 2026-10-14, on `chore/dependency-upgrades`, from a measured run of the plugin over every linted workspace and a survey of what other tools ship (`research.md`).

## Problem Statement

Lint checks style, React's rules and unused code, but nothing looks for bug patterns. Measuring the plugin found real ones that review missed:

- A ternary that returns the same value on both branches (3).
- Arrays sorted without a comparator (16).
- Regular expressions with super-linear backtracking (39).
- 125 uses of deprecated APIs.

## Decisions

- **The plugin:** `eslint-plugin-sonarjs` 4.2.2. It supports ESLint 10, and its `typescript >=5 <6.1.0` range covers our 6.0.3.
- **The profile is SonarQube's default, Sonar way core, plus `deprecation`.**
  - Since SonarQube Server 2026.5 and on SonarQube Cloud, "Sonar way core" is the default profile for every language. The plugin's `recommended` preset is the old "Sonar way", which SonarQube now calls "comprehensive".
  - Core holds every security rule, the recommended reliability rules of medium severity and up, and the recommended maintainability rules of blocker severity ([built-in quality profiles](https://docs.sonarsource.com/sonarqube-server/quality-standards-administration/managing-quality-profiles/built-in-quality-profiles)).
  - SonarSource publishes no rule list for core, so ours is derived from SonarJS's rule metadata at the commit 4.2.2 was published from ([aebf8d46](https://github.com/SonarSource/SonarJS/tree/aebf8d46933ec80ff3437ceb69e320b5a97b7108)). A rule is in when any of its impacts qualifies, as in SonarQube's default mode (MQR). That gives 130 of the plugin's 295 rules. The older type-and-severity reading gives 122, all within those 130.
  - `deprecation` is added on top. Core leaves it out, but we want deprecated APIs found.
- **Per language, as SonarQube applies it:** 122 rules run on every file, 8 on JavaScript only (TypeScript's checker covers them, `different-types-comparison` among them), and 1 on TypeScript only (`no-useless-intersection`).
- **Left out with core:** `no-unused-vars` (`@typescript-eslint/no-unused-vars` covers it), `cognitive-complexity`, the nesting rules, `todo-tag`, `prefer-read-only-props` and the other maintainability rules below blocker.
- **Type information on:** `projectService: true`. 31 of the 131 rules read types, `deprecation` and `no-alphabetical-sort` among them; without types they report nothing or run a weaker check. Measured cost of the whole `pnpm lint`, with the full preset: from about 11 s to about 46 s.
- **Every finding gets fixed.** A finding that is deliberate gets a one-line `eslint-disable-next-line` with the reason. `Math.random()` for retry jitter is one example; `http://localhost` in a dev default is another.
- **While the work runs, `pnpm lint` stays green.** Rules with findings left are switched off in one block, each line naming the ticket that fixes it. Each ticket deletes its lines, and the last one deletes the block.
- **Out of scope:** `apps/mobile`, `apps/docs` and `apps/quick-import-extension`, which no lint gate reaches. Test-file scoping, which SonarQube also does, is left out: lint skips the unit tests, and only two findings sit in the E2E suites that a Main-only rule would skip.
- **No ADR, no release notes:** the change is cheap to reverse, and users don't see it.

## Baseline

Measured on 2026-10-14 with type information on: **210 findings in 14 rules, in 102 files.**

| Group                     | Findings | Files | Ticket |
| ------------------------- | -------: | ----: | ------ |
| Bug patterns and security |       46 |    31 | 02     |
| Regular expressions       |       39 |    25 | 03     |
| Deprecated APIs           |      125 |    54 | 04     |

By workspace: `apps/web` 111, `packages/shared` 24, `packages/shared-server` 22, `packages/db` 16, `packages/api` 10, `packages/shared-react` 8, `packages/auth` 5, `packages/config` 4, `tooling/nutrition` 4, `packages/trpc` 3, `packages/queue` 2, `tooling/ingredient-icons` 1.

## Tickets

1. `issues/01-the-plugin-runs-with-type-information.md`
2. `issues/02-bug-patterns-and-security.md`
3. `issues/03-regular-expressions.md`
4. `issues/04-deprecated-apis.md`

## Comments

- 2026-10-14. The first version of this plan took the plugin's whole `recommended` preset with everything on: 623 findings and eight tickets, including cognitive complexity and nesting. After `research.md` showed that SonarQube itself moved to the lighter core profile, and that most projects loosen the preset, the maintainer chose core plus `deprecation`. Tickets 05 to 08 (nesting and cognitive complexity) were dropped.
