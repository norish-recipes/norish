# 03 — A user exports everything they can see

**What to build:** a signed-in user presses an Export button in their settings — inside the existing archive-import card — and their browser immediately starts downloading `norish-recipes-<date>.norishrecipes`, containing every recipe they can see under the deployment's view policy. The download streams from the first byte and the file reimports cleanly through the flow ticket 02 built.

Scope is delegated, never reimplemented: the export service passes the existing recipe-list viewer context to the existing visibility layer, so own, household-visible, and orphaned recipes are included exactly as the library shows them. Delivery is a session-authenticated streaming route handler (the media-serving routes are the precedent — not tRPC), and no artifact ever exists server-side. Media is not yet inside the archive (ticket 04).

**Blocked by:** 02 — A `.norishrecipes` file imports like any other archive.

**Status:** resolved

- [x] Export button with a busy state joins the existing archive-import card in the user settings tab; all strings localized across supported locales and the i18n gate passes
- [x] The route streams the zip as it is produced, session-authenticated, with a dated `.norishrecipes` content-disposition filename
- [x] A signed-out request is refused
- [x] The archive contains one folder per visible recipe, scope computed by the existing recipe-listing visibility logic — no new visibility code
- [x] The manifest's exporter block is filled: display name, instance origin, timestamp, recipe count
- [x] No temp files or stored archives exist on the server after an export
- [x] The downloaded archive imports back through the import flow (round-trip demo on a dev instance)
