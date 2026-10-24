# 01 — The plugin runs SonarQube's default profile with type information

Status: resolved

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

`eslint-plugin-sonarjs` runs Sonar way core plus `deprecation` in every linted workspace, with type information, and `pnpm lint` stays green while tickets 02 to 04 fix the findings.

- `@norish/eslint-config` depends on `eslint-plugin-sonarjs` (^4.2.2).
- One module in `tooling/eslint` holds the profile as rule lists:
  - 122 rules for every file;
  - 8 for JavaScript only;
  - 1 for TypeScript only.

  It says where the lists come from (the spec), and `base.ts` applies them. It does not use the plugin's `recommended` preset.

- `base.ts` turns on `projectService` for the files it lints. Every file the gate lints parses with type information. The measured run found one that doesn't: `apps/web/app/sw.ts`, which `tsconfig.sw.json` covers rather than `tsconfig.json`.
- One block turns off the 14 rules that still have findings, each line naming the ticket that fixes it.

## Acceptance criteria

- [x] `pnpm lint` passes with the plugin on, and `@norish/eslint-config` typechecks.
- [x] No parsing error in any workspace.
- [x] With the temporary block lifted, lint reports the baseline: 14 rules, about 210 findings, nothing from a rule outside the profile.
- [x] Each rule in the temporary block has findings today and names its ticket.
- [x] Lint time before and after is recorded here, for `apps/web` and for the whole `pnpm lint`.

## Comments

- 2026-10-14 (implemented).
  - The profile is `tooling/eslint/sonarjs.ts`: three lists generated from SonarJS's rule metadata at the 4.2.2 commit (122 for every file: 121 from Sonar way plus `deprecation`; 8 for JavaScript; 1 for TypeScript). `base.ts` applies it after the existing rules, then the temporary block of 14 rules.
  - The plugin is a CommonJS module. Its default import types as `ESLint.Plugin`, which goes straight into `plugins`; its `recommended` preset is not used, so its `settings.react.version` doesn't leak into the shared settings either.
  - `apps/web/eslint.config.ts` lints `app/sw.ts` against `tsconfig.sw.json` with the project service off for that file.
  - With the block lifted, lint reports exactly the baseline: 210 findings in the 14 rules, no parsing error, nothing from another rule.
  - Lint time, measured on this machine with nothing cached:
    - the whole `pnpm lint` (`turbo run lint --force`): about 11 s before, 40 s after;
    - `apps/web` alone: 3.7 s before, 16.0 s after.
- 2026-10-15 — The every-file list named `deprecation` twice, alphabetically and appended; the duplicate is gone and the count above is corrected (branch review).
