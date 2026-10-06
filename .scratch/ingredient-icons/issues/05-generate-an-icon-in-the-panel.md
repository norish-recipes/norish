# 05: Generate an icon in the panel

**What to build:** In the Ingredient panel, Generate draws the food an icon with the instance's image provider. The icon is drawn from the food's own name and its parent chain ("pepper, a kind of spice"), in the instance's icon style, then cut out. The result lands in the draft and is kept only on Save. On an instance where nothing can draw, Generate is hidden and Upload still works. See `.scratch/ingredient-icons/spec.md`.

**Blocked by:** 01

**Status:** done, pending review

- [x] The AI Runtime's image entry point accepts a square shape: 1024×1024, or the provider's square aspect, per provider.
- [x] It also accepts the cheapest quality tier where the provider has one (OpenAI-family `low`). Providers without tiers are unchanged, and recipe pictures keep their current behaviour.
- [x] A new administrator-editable Prompt, `ingredient-icon-style`:
  - [x] has a shipped default describing the soft-3D style;
  - [x] has no system turn, like `image-generation-style`;
  - [x] has config, loader and translations in every locale;
  - [x] passes the prompt-sync and prompt-default tests.
- [x] The feature appends Prompt Sections and never passes a finished prompt (ADR-0016):
  - [x] the food's name, English where known;
  - [x] its parent chain;
  - [x] a code-owned section asking for one food centred on a flat background with no shadow or props, and for foods with no shape of their own to sit in the plainest vessel.
- [x] Generate runs inside the request. Its result is made into an icon (ticket 01's function), stored as an unattached file and put in the draft. A failure shows a toast and leaves the draft as it was.
- [x] "Can draw" (AI enabled and an Image Generation provider configured) reaches the browser beside `isAIEnabled`. Generate is hidden without it, and the server refuses without it or without edit rights.
- [x] Tests:
  - [x] the runtime image test is extended (square per provider, cheapest tier, the icon Prompt and its sections);
  - [x] the router at the tRPC caller (refused when it can't draw or may not edit).

## Comments

2026-10-06 (implementation): the runtime's image entry point takes `shape: "square"` (1024×1024, Google's 1:1) and a `tier` (`low`/`medium`, the latter for the maintainers' sample sheet). Tiers follow the model's name: gpt-image's low/medium, DALL·E 3's standard; DALL·E 2, Google, Ollama and OpenAI-compatible endpoints take none. "Can draw" is `canDrawImages` on `permissions.get` and `canDrawImages()` in the server config loader. The menu item reads "Generate with AI".

2026-10-06 (after the first sample run): the tier by model name is gone. `gpt-6-luna` draws but refused the `response_format` the SDK adds to any model whose name it does not know. Per ADR-0014, every OpenAI-family model is now asked for the tier, and a model that refuses `quality` or `response_format` is asked again without it and remembered for the process (`ai/runtime/image-parameter-fallback.ts`). This holds for a dish's picture too.
