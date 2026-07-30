# 02 — Provenance pipeline: infer and store country, region, and note

Status: ready-for-agent
Blocked by: None — can start immediately

Spec: `.scratch/recipe-provenance/spec.md`

## What to build

Recipe Provenance becomes the fifth kind of Recipe Enrichment. When a recipe becomes usable and the administrator has switched provenance on, a background job infers where it comes from — an origin country, an optional region, and a short written note — and stores them atomically. Nothing renders yet; ticket 03 puts it on the page.

The kind rides the machinery the other four already use. One coordinator decides eligibility, one queue carries the work, one lifecycle contract reports progress, one repository operation persists the result. Adding it should read as a worked example of adding an enrichment kind, not as a parallel pipeline.

## Notes

**The note is written in the language of the recipe itself**, inferred by the same prompt from the recipe text it already has. One note, not a map. No per-locale storage, no translation step, no second request, and no language-detection step. The note's language is not constrained to the deployment's enabled locales — a Japanese recipe gets a Japanese note — and it is not recorded anywhere.

Where a language distinguishes formal and informal register, nothing selects between them. A German recipe may get `Du` or `Sie`. Accepted, not handled.

**The coordinator is not refactored.** Provenance requires ingredients exactly like the other four kinds and inherits the existing blanket pre-check unchanged. A recipe with a title and no ingredients skips with `insufficient-input`.

The origin country is stored as an ISO-3166-1 alpha-2 code, never a display name, so the client can localise it. The region is free text and is never translated.

Substantive provenance is Supplied Recipe Data and suppresses automatic enrichment for the **whole group**, following the atomic precedent set by Nutrition Information. A manual run replaces the whole group regardless.

The automatic switch defaults **off** — an upgrade must not silently start spending AI.

## Acceptance criteria

- [ ] Recipe Provenance is a fifth member of the enrichment kind vocabulary; lifecycle states, origin values, skip reasons and enrollment outcomes are reused unchanged.
- [ ] The combined status contract returns five kinds, always five, and maps retained job state onto the shared lifecycle states.
- [ ] Removing retained history returns provenance to idle.
- [ ] Provenance has its own queue with deterministic per-recipe-and-kind job identity, inheriting the shared retry, backoff and retention options.
- [ ] Enqueuing provenance does not disturb the identity or independence of the other four queues.
- [ ] A fifth automatic switch exists, defaults off, and is independent of manual availability.
- [ ] The coordinator enrolls provenance under the same ingredient pre-check as the other four kinds, with no coordinator refactor.
- [ ] Substantive stored provenance in any field suppresses an automatic run for the whole group; a manual run replaces it regardless.
- [ ] One repository operation writes country, region and note atomically; partial application is impossible and a failed write leaves no partial group.
- [ ] Automatic runs write conditionally and defer to supplied data that appeared mid-flight; manual runs write unconditionally.
- [ ] Empty or failed AI output never erases stored provenance.
- [ ] The worker holds no database handle and composes no queries of its own.
- [ ] The inference prompt is administrator-editable through the existing prompt administration surface.
- [ ] Inference reads only the stored recipe — never parser output, import metadata, or how the recipe entered Norish.
- [ ] Inferrer tests mock only the external AI provider and prove the note comes back in the recipe's language for at least two different recipe languages, and that an unparseable response fails without writing.
- [ ] Worker tests cover validated persistence, retry on transient failure, terminal lifecycle failure, canonical recipe update emission, and origin-aware notification.
- [ ] With AI globally disabled the kind is inert, not broken.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Cuisines. Ticket 04.
- Any recipe-page or recipe-form rendering. Tickets 03 and 05.
- Backfilling recipes that already exist — out of scope for this feature.
- Recording which language the note was written in.
