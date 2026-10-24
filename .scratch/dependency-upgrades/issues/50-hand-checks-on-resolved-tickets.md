# 50 — Hand checks on resolved tickets

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

These criteria need a real API key or a person at the screen. Tick each box in its own ticket once done.

- **05, Real-key checks (Perplexity Agent API).** The connection test succeeds, a URL import works (structured output), and an image import works (vision).
- **29, Real-key smoke.** One hosted provider, plus the OpenAI-compatible or Ollama path.
- **19, HeroUI surfaces.** On desktop and touch, check date pickers, selects, modals, drawers and menus. The E2E suite exercises most of these, but only the date picker has its own spec.
- **26, Image surfaces.** On a production build, check that every image still renders: recipe cards, the gallery, step images, cooking mode, the lightbox, planner thumbnails, cookbook covers, avatars and the logo.

## Acceptance criteria

- [x] Each check above is done and ticked in its ticket.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Closed by the maintainer; the boxes in 05, 19, 26 and 29 are ticked there.
