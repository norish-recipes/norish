# 03 — Provenance on the recipe page

Status: ready-for-agent
Blocked by: 02 — Provenance pipeline: infer and store country, region, and note

Spec: `.scratch/recipe-provenance/spec.md`

## What to build

A cook opens a recipe and sees where it comes from: the country's flag, the country's name in their own language, the region when there is one, and the note. If inference is running right now, the section says so rather than looking empty. If a recipe has no provenance and nothing in flight, the section is absent entirely — recipes that will never have it show nothing.

A housemate's screen updates as soon as provenance is inferred, without a reload. An Offline user sees the same thing a Live user sees.

## Notes

The country name is localised at render time through the platform's region display names, from the stored alpha-2 code. The region and the note are shown exactly as stored — the note is recipe content in the recipe's own language, and is never translated.

Lifecycle progress rides the **single existing enrichment contract**. No new subscription, no new status query, no new client integration point. If provenance seems to need one, that is a leak worth reporting rather than working around.

Provenance travels into the Offline Cache and the Warm Set with the recipe and needs no separate warming.

All new interface work uses the HeroUI version the application is on. Upstream PR 350's component predates it — treat it as a description of what to show, not as code to port. Its localised country rendering is worth harvesting.

## Acceptance criteria

- [ ] The recipe detail page shows the country flag, the localised country name, the region when present, and the note.
- [ ] The section is absent when there is no provenance and no run in progress.
- [ ] An in-progress run renders as in-progress rather than as an empty section.
- [ ] Provenance lifecycle and canonical recipe updates flow through the existing enrichment contract, with no provenance-specific subscription.
- [ ] A housemate's inferred provenance appears without a reload.
- [ ] Provenance is present on Warm Set recipes while Offline, with no separate warming step.
- [ ] Interface strings are added for every enabled locale and the internationalization gate passes.
- [ ] UI tests cover the absent state, the in-progress state, and localised country rendering.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Cuisines on the page. Ticket 04.
- Editing or clearing provenance. Ticket 05.
- Translating the note or the region.
- Browsing or filtering recipes by origin.
