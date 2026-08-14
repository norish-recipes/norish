# 01 — Login tagline: "Any source, any recipe."

Status: ready-for-human

**What to build:** In `packages/i18n/src/messages/*/auth.json`, replace the login subtitle (`login.subtitle`, line 5 in each file — not the signup subtitle on line 32). English becomes exactly `Any source, any recipe.`; the other 13 locales (bg, da, de-formal, de-informal, es, fr, it, ko, nl, no, pl, pt-BR, ru) get a natural native translation of that line, drafted for maintainer review — not a word-for-word calque if the language wants a different shape. The currently broken French line ("Nourish à chaque moment.") disappears as a side effect.

**Done when:** all 14 `auth.json` files carry the new line, `pnpm i18n:check` passes, and the 13 translations have been presented to the maintainer for review in the PR/summary.

## Comments

- 2026-08-14: All 14 locales updated; `pnpm i18n:check` passes. Drafted translations for maintainer review (Danish/Norwegian take the plural "all sources" shape, French takes "toutes les sources" — the "any X, any Y" calque is unnatural there; German is identical in both registers since the line has no second person):
  - en: `Any source, any recipe.`
  - bg: `Всеки източник, всяка рецепта.`
  - da: `Alle kilder, alle opskrifter.`
  - de-formal / de-informal: `Jede Quelle, jedes Rezept.`
  - es: `Cualquier fuente, cualquier receta.`
  - fr: `Toutes les sources, toutes les recettes.`
  - it: `Qualsiasi fonte, qualsiasi ricetta.`
  - ko: `어떤 출처든, 어떤 레시피든.`
  - nl: `Elke bron, elk recept.`
  - no: `Alle kilder, alle oppskrifter.`
  - pl: `Dowolne źródło, dowolny przepis.`
  - pt-BR: `Qualquer fonte, qualquer receita.`
  - ru: `Любой источник, любой рецепт.`
