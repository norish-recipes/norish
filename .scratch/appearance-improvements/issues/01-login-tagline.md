# 01 — Login tagline: "Any source, any recipe."

Status: ready-for-agent

**What to build:** In `packages/i18n/src/messages/*/auth.json`, replace the login subtitle (`login.subtitle`, line 5 in each file — not the signup subtitle on line 32). English becomes exactly `Any source, any recipe.`; the other 13 locales (bg, da, de-formal, de-informal, es, fr, it, ko, nl, no, pl, pt-BR, ru) get a natural native translation of that line, drafted for maintainer review — not a word-for-word calque if the language wants a different shape. The currently broken French line ("Nourish à chaque moment.") disappears as a side effect.

**Done when:** all 14 `auth.json` files carry the new line, `pnpm i18n:check` passes, and the 13 translations have been presented to the maintainer for review in the PR/summary.

## Comments
