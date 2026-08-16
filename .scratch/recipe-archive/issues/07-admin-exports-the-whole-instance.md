# 07 — An admin exports the whole instance

**What to build:** a server admin presses the same Export button — rendered in the admin tab's existing General card — and downloads a Recipe Archive of every recipe on the instance, regardless of view policy. It is the same operation, format, and route mechanics as ticket 03 with admin scope; the admin doorway exists for discoverability, not for extra data (ADR-0022). Authorisation is server-side: a non-admin calling the instance-wide export is refused no matter what the UI shows.

**Blocked by:** 03 — A user exports everything they can see.

**Status:** resolved

- [x] The same export-button component renders in the admin tab's General card, localized, with instance-wide wording
- [x] The instance-wide export requires server-admin authorisation server-side; a non-admin request is refused
- [x] The archive contains every recipe on the instance, produced by the same format and streaming mechanics as the user export
- [x] A signed-in non-admin never sees the admin doorway, and hitting the route directly still fails
