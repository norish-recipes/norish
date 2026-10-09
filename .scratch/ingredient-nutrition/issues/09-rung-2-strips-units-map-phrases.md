# 09: Rung 2 strips units-map phrases

**What to build:** The resolver's second rung, which today strips the preparation (text after the first comma, anything bracketed), also strips a phrase from the units map found at the start or end of the text. So "salt to taste", "naar smaak zout" and "a pinch of nutmeg" resolve to salt and nutmeg. The units map gains serving phrases in every locale it covers: "to serve", "for garnish", "optional". Client and server share the rule through the spelling-keys module, so a line typed offline is matched the same way before it syncs.

**Blocked by:** None (can start immediately)

**Status:** done, pending gates and review

- [x] "Salt to taste", "sweet chilli sauce to serve" and "a pinch of nutmeg" resolve on rung 2 to the Ingredients their remaining words name.
- [x] Stripping happens only at either end; a phrase inside the name is kept.
- [x] An administrator's edit to the units map changes what is stripped.
- [x] Client and server produce the same food key for the same text.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. Rung 2 takes a second look on the bare fold with units-map phrases stripped at either end (`spellingKeys(text, phrases).plainFold`, `unitPhrases(units)` in `@norish/shared/lib/spelling-keys`); a leading phrase takes its connector with it ("a pinch **of**", "pincée **de**"). The web client reads the same phrases through `useUnitPhrases()` for its pantry matching.
- Narrowed while implementing: only the units map's vague amounts and serving phrases are stripped (`to_taste`, `to_serve`, `for_garnish`, `optional`, `pinch`, `generous_pinch`, `knife_tip`, `dash`, the splashes, `drizzle`, `handful`), never its measures, pieces or containers. Stripping every unit turned "onion rings" into onion and "glass noodles" into noodles, which an existing review test caught. An administrator still changes what is stripped by editing those entries' names and alternates.
- A mint is still named and aliased by the text without its preparation only, not without its phrases, so a stripped phrase never becomes a spelling of its own.
