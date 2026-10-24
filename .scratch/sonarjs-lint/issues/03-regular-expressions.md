# 03 — Regular expressions

Status: resolved
Blocked by: 01

Spec: `.scratch/sonarjs-lint/spec.md`.

## What to build

The 39 `super-linear-regex` findings (25 files) are fixed, and the rule leaves the temporary block.

These patterns can backtrack for a long time on a crafted input. That matters most where the input comes from outside: recipe pages, pasted text and imports.

A rewritten pattern keeps matching exactly what the old one matched. Where no unit test covers it, add one before rewriting.

## Acceptance criteria

- [x] `sonarjs/super-linear-regex` is not in the temporary block, and `pnpm lint` passes.
- [x] Every rewritten pattern is covered by a test that passed against the old pattern too.

## Comments

- 2026-10-14 (implemented).
  - 36 patterns rewritten, 3 kept with a disable. Tests were written first and ran green against the old patterns, then again against the new ones; the E2E spec's two patterns are covered by the same proof as their unit-tested siblings.
  - Rewritten with the same matches, checked by a throwaway differential run (old against new, 200,000 random strings per pattern, no difference):
    - A leading run can no longer restart inside itself: `(?<!X)X+…` (trailing slashes and dots, `\d+ h`/`\d+ min`, the money and item counts in `grocery-prices.e2e.ts`, `[attempt N]`, the space before closing punctuation). The leftmost match never starts after an X, so the match is the same.
    - The trailing-zero trim is one copy, `formatAmountAsDecimal`; the three web copies and `formatServings` use it.
    - The surrounding `\s*` went from the grouping patterns, whose result collapses whitespace anyway; CIQUAL's `\s*\/\s*` became ` ?\/ ?` after the collapse before it.
    - The anchored pack-size and quantity patterns lost their ambiguity (`\s*(N)?\s*` → `\s*(?:(N)\s*)?`, `\d*[.,]?\d+` → `\d+(?:[.,]\d+)?|[.,]\d+`, the parenthetical's `\s*` cannot start after a space).
    - `-.*$` and `[([].*$` lost the `$`: they differ only on a text with a line break, which a version and an ingredient line do not have.
  - Rewritten with a narrower class, the only way the rule's analysis accepts a bracketed span: the class excludes the opener too (`\([^()]*\)`, `\[[^[\]]+\]`, `<[^<>]*>`, `\{[^{}]+\}`, and `[^?&=]+` for an OpenSearch key). The match changes only where an opener stands again before the closer (nested or stray brackets, a `<` in tag text, a `?` inside a query key): the old pattern took the span from the outer opener, the new one the inner. Sites: grocery grouping, `stripPreparation`, the recipe-link tokens (smart markdown, mini groceries), `stripHtmlTags`, VTT captions (where a bare `<` is invalid anyway), the OpenSearch template.
  - Disabled, with the reason on the line: `redactUrl`'s fallback (a configured connection URL, and a password may hold the `/` a narrower class would stop at), and `normaliseFoodName` and `isWhipped` in `tooling/nutrition` (dataset names the tool downloads; a narrower pattern could change the generated tables).
- 2026-10-14 (review). The bracket rewrites are the one place the criterion "keeps matching exactly what the old one matched" does not hold, on nested or stray brackets only; it is the maintainer's call whether that stands or those six sites go back to their old patterns with a disable. `grocery-prices.e2e.ts`, whose two patterns have no unit test, passed every one of five repeats.
- 2026-10-15 (maintainer's call: "this needs to be fixed"). Neither the old nor the narrowed patterns were right on nested or stray brackets, so each site now gives the right answer, each with a test:
  - Grocery grouping key, its display name, and `stripPreparation`: `stripBracketed` (helpers) removes the innermost span and repeats until none is left, so brackets inside brackets go with them (`tomatoes (canned (400 g))` is `tomatoes`; `onion (red (x) y) chopped` is `onion chopped`, as `onion (red) chopped` is). A bracket that never closes still stays.
  - `stripHtmlTags`, VTT captions and the recipe-link tokens keep the narrowed patterns, which were the right ones: a lone `<` or `[` that opens nothing is text and stays (`if a < b <b>bold</b>` is `if a < b bold`; `[a [Sauce](id:…)` links Sauce). The old patterns dropped that text.
  - The OpenSearch template is split on its first `?` and on `&` instead of matched: everything after the first `?` is the query, so `x?y={startPage?}` is one optional parameter and goes whole, as the old pattern had it.
