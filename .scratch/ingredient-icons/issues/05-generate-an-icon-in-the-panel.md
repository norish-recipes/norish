# 05: Generate an icon in the panel

**What to build:** In the Ingredient panel, Generate draws the food an icon with the instance's image provider. The icon is drawn from the food's own name and its parent chain ("pepper, a kind of spice"), in the instance's icon style, then cut out. The result lands in the draft and is kept only on Save. On an instance where nothing can draw, Generate is hidden and Upload still works. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The AI Runtime's image entry point accepts a square shape: 1024×1024, or the provider's square aspect, per provider.
- [ ] It also accepts the cheapest quality tier where the provider has one (OpenAI-family `low`). Providers without tiers are unchanged, and recipe pictures keep their current behaviour.
- [ ] A new administrator-editable Prompt, `ingredient-icon-style`:
  - [ ] has a shipped default describing the soft-3D style;
  - [ ] has no system turn, like `image-generation-style`;
  - [ ] has config, loader and translations in every locale;
  - [ ] passes the prompt-sync and prompt-default tests.
- [ ] The feature appends Prompt Sections and never passes a finished prompt (ADR-0016):
  - [ ] the food's name, English where known;
  - [ ] its parent chain;
  - [ ] a code-owned section asking for one food centred on a flat background with no shadow or props, and for foods with no shape of their own to sit in the plainest vessel.
- [ ] Generate runs inside the request. Its result is made into an icon (ticket 01's function), stored as an unattached file and put in the draft. A failure shows a toast and leaves the draft as it was.
- [ ] "Can draw" (AI enabled and an Image Generation provider configured) reaches the browser beside `isAIEnabled`. Generate is hidden without it, and the server refuses without it or without edit rights.
- [ ] Tests:
  - [ ] the runtime image test is extended (square per provider, cheapest tier, the icon Prompt and its sections);
  - [ ] the router at the tRPC caller (refused when it can't draw or may not edit).
