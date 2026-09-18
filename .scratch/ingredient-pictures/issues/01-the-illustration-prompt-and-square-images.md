# 01 — The Ingredient Illustration prompt and square image requests

Status: resolved

Spec: `.scratch/ingredient-catalog/spec.md`

## What to build

A twelfth administrator-editable Prompt, `ingredient-illustration-style`, registered in every exhaustive map (loader, overrides, config schema, prompts form, retired-defaults generator and file, test fixtures) with its three translation keys in every locale. `generateImage` accepts it, and takes a `shape` so an Ingredient Illustration is drawn square: 1024×1024 on OpenAI, Azure and OpenAI-compatible endpoints, 1:1 on Google.

## Notes

Image prompts are typed out of structured generation (`ImagePromptName`), so the new prompt needs no system message. The retired-defaults test fails if the generator is not re-run.

## Acceptance criteria

- [x] The prompt ships a default, is editable under AI & Processing => Prompts, and is pruned to an override like every other.
- [x] `generateImage({ prompt: "ingredient-illustration-style", shape: "square" })` sends a square size and the prompt with the name appended.
- [x] Existing landscape requests are unchanged.

## Comments

- 2026-09-17: Implemented; runtime test asserts the 1024×1024 request and the appended name.
