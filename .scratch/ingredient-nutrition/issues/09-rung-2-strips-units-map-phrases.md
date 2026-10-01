# 09: Rung 2 strips units-map phrases

**What to build:** The resolver's second rung, which today strips the preparation (text after the first comma, anything bracketed), also strips a phrase from the units map found at the start or end of the text. So "salt to taste", "naar smaak zout" and "a pinch of nutmeg" resolve to salt and nutmeg. The units map gains serving phrases in every locale it covers: "to serve", "for garnish", "optional". Client and server share the rule through the spelling-keys module, so a line typed offline is matched the same way before it syncs.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] "Salt to taste", "sweet chilli sauce to serve" and "a pinch of nutmeg" resolve on rung 2 to the Ingredients their remaining words name.
- [ ] Stripping happens only at either end; a phrase inside the name is kept.
- [ ] An administrator's edit to the units map changes what is stripped.
- [ ] Client and server produce the same food key for the same text.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
