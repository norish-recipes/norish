# 01 — A Store points at a shop and gets a Search Address

Status: ready-for-human
Blocked by: None — can start immediately

Spec: `.scratch/simplified-grocery-linking/spec.md`

## What to build

A Store gains two nullable columns — `website` and `searchAddress` — and the store form gains one field to fill them from a single paste. The derivation is a pure function: pasted URL in, Search Address out, plus a flag saying whether the slot was found or the paste looks like a plain website. Nothing fetches anything yet; verification and discovery arrive with the reader in ticket 02, and until then a paste with no recognisable slot is simply kept as the Store's website.

The field shows the resolved preview under itself (`https://www.ah.nl/zoeken?query={query}` with the slot marked, and an example resolved against a sample term), and stays editable, because a wrong guess must be one keystroke from correct.

## Notes

**The derivation never reads a parameter or segment name.** Norish ships fourteen locales — bg, da, de, en, es, fr, it, ko, nl, no, pl, pt-BR, ru — and is self-hosted well beyond them. A shop searches on `szukaj`, `recherche`, `suchbegriff`, `busqueda` or a Korean word, and any list of search words we write is a list that is wrong everywhere it has not been extended. So the slot is found by the **shape of the value**, not the meaning of the key.

Order, on the normalized URL: an existing `{query}` wins outright; then, among query parameters, the sole one if there is only one, else the single value that looks like something a person typed; then the trailing path segment if it passes the same test; else the paste is a plain website and ticket 02's discovery handles it.

"Looks typed" means: contains Unicode letters (`\p{L}` — `[a-z]` would fail every Cyrillic and Hangul shop we ship a translation for), is not purely numeric, and is not a locale tag (`nl`, `en-US`), a boolean, a UUID, a bare id, or a repeat of a path segment. Where two values qualify, rank them and put the better one in the preview; the field is editable, so a ranked guess costs a keystroke and a wrong certainty costs trust.

Both real shops must come out right from either form of paste — `https://www.ah.nl/zoeken?query=test` and `https://www.ah.nl/zoeken?query=kaas` both give `?query={query}`; `https://www.dirk.nl/zoeken/producten/test` and `.../producten/kaas` both give `/zoeken/producten/{query}` — but they prove nothing about the rule, because both are shops whose words we happen to know. The tests that matter are the ones in a language the algorithm has never heard of.

The user never authors a template, so no UI anywhere should ask them to "use `{query}`" as a first instruction — that wording belongs only in the fallback state where derivation found nothing.

Resolving an address means URL-encoding the term into the slot. A term with a space, a slash or an ampersand must not produce a broken URL; that is a unit test, not a hope.

Stores are per-user with household access (`ctx.userIds`); these columns inherit that exactly, so Product Links and Store Products in later tickets are household-shared through the Store the household already shares. No new permission surface.

## Acceptance criteria

- [x] `stores` gains nullable `website` and `search_address` columns with a migration.
- [x] A pure derivation function turns a pasted URL into a Search Address, or reports that the paste is a plain website.
- [x] All four real-shop pastes in the Notes derive the correct Search Address.
- [x] No parameter name, path segment or search-word vocabulary appears anywhere in the derivation.
- [x] Search parameters named in German, French, Polish and Korean derive correctly, as does a term in a trailing path segment.
- [x] A Cyrillic and a Hangul search term are both recognised as typed values.
- [x] A URL whose parameters are only ids, page numbers, sort keys and locale tags derives nothing and is treated as a plain website.
- [x] Where two values qualify, the better-ranked one is offered in the preview rather than the first one found.
- [x] Resolving a Search Address URL-encodes the term; spaces, slashes and ampersands round-trip.
- [x] The store create and edit forms take one pasted link, show the resolved preview, and keep the field editable.
- [x] A Store with neither column behaves exactly as a Store does today, everywhere it is used.
- [x] The tRPC surface validates the address (parseable URL, http/https only) and rejects anything else with a typed error.
