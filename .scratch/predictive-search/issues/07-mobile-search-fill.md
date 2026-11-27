# 07: Fill arrow on mobile Search

**What to build:** A ↖ fill arrow on each typing-suggestion row of mobile Search, as picked on the canvas. Tapping it puts the row's text in the bar through `setText` (`apps/mobile/src/features/search/hooks/use-search-field.ts`) without confirming a search or adding a filter. See the spec, "Solution".

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] **Rows:** the rows from `use-typing-suggestions.ts` are ordered through the match rule; each gets the arrow.
- [ ] **Fill only:** no Recent Search is made, no filter chip is added, the keyboard stays up and the rows update for the new text.
- [ ] **Tests:** a component test for the fill; device check on the iOS Simulator.
