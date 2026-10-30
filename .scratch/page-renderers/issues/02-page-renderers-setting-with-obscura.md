# 02: The Page Renderers setting, with Obscura in it

**What to build:** An administrator sees a **Page Renderers** card in admin settings. They can switch Obscura on or off and edit its endpoint, its CDP token and the navigation timeout, and imports use what they saved without a restart.
- The setting is a new sensitive `server_config` row, seeded at first boot from env following the `AI_CONFIG` pattern. That way an upgrader's `OBSCURA_ENDPOINT` and `OBSCURA_CDP_TOKEN` carry over, and fresh installs get Obscura on.
- `OBSCURA_NAVIGATION_TIMEOUT_MS` becomes `PAGE_RENDERER_TIMEOUT_MS` as a clean break.
- With Obscura off, every caller gets empty HTML from the rendered-page entry point and continues as it does when a render fails, so URL import goes through the plain fetch alone.

See `.scratch/page-renderers/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The new server-config key and its schema are added: `obscura { enabled, endpoint, cdpToken? }`, `navigationTimeoutMs`, plus the solver and private-address fields that tickets 03 and 04 fill in, defaulted off. A loader for it sits beside the AI and video loaders
- [ ] First boot seeds the row from env, after which env changes do nothing. `OBSCURA_ENDPOINT` no longer reads as required
- [ ] The Obscura connection reads endpoint, token and timeout from the setting, and a changed endpoint or token replaces the cached connection on the next render
- [ ] With Obscura switched off, the rendered-page entry point returns empty HTML without dialling Obscura
- [ ] Admin tRPC read and save procedures exist. Read masks the CDP token, save with the masked token keeps the stored one, and a non-admin is refused
- [ ] The Page Renderers card is a SettingsCard with one-line sentence-case descriptions, footer buttons through ActionButtonGroup, and i18n keys in every locale
- [ ] Tests: seeding, including the upgrader case; router masking and refusal; the Obscura toggle and reconnect at the rendered-page seam
- [ ] E2E: an administrator edits the Obscura endpoint, saves, reloads and sees it kept, and the CDP token is never shown in full
- [ ] `.env.example` and the Compose example use the renamed timeout var, and the 0.26.0 Upgrade notes cover the setting moving to admin settings (seeded from env) and the rename
