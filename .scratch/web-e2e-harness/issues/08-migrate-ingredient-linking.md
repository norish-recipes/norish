# 08 — Migrate Ingredient Linking scenarios

**What to build:** Move Ingredient Linking onto the consolidated AI fixture and remove its dependence on browser state left by an earlier test while preserving the connected editor, reader, cooking, sharing, and persistence journey.

**Blocked by:** 04 — Establish the isolated AI project

**Status:** ready-for-agent

- [ ] Manual Ingredient Linking still attaches aggregate ingredients and persists fractional amounts through the real AI and worker path.
- [ ] Cooking mode still presents the active step's resolved Step Ingredients.
- [ ] An unauthenticated share-link reader still sees the same resolved amounts.
- [ ] Editor attachment still asks for an amount and Escape still keeps the whole ingredient line.
- [ ] Gap-filling still preserves a hand-attached Step Ingredient while filling eligible bare steps.
- [ ] Journeys that genuinely share one recipe are represented as one independently runnable scenario with explicit steps, or arrange equivalent deterministic prerequisites.
- [ ] Fresh browser pages do not weaken persistence, share-link, or realtime assertions.
- [ ] Ingredient Linking actions and stored Step Ingredient probes remain local to Ingredient Linking support.
- [ ] The migrated scenarios can be selected independently without relying on execution order from another file or test.
- [ ] The complete migrated coverage passes through the consolidated `ai` project.
