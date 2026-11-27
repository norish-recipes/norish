# 04: "Rotate master key" and docs

**What to build:** The Admin action that rotates a generated key, and the docs for an optional `MASTER_KEY`. See the spec, "Rotation trigger".

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] **tRPC:** an admin procedure beside `restartServer` (`packages/trpc/src/routers/admin/system.ts`) that writes a new `current`, moves the old key to `previous`, then restarts. Refused in env mode and on a Demo Instance.
- [ ] **Web:** an action on the System card (`apps/web/features/admin/components/system/system-card.tsx`) with a confirmation saying every session ends. In env mode the card shows the `MASTER_KEY` + `MASTER_KEY_PREVIOUS` instruction instead. Strings in `packages/i18n`.
- [ ] **Mobile:** a session ended by rotation lands on sign-in without an error state.
- [ ] **E2E:** rotate in file mode, sign in again, a saved site auth token and a share link still work.
- [ ] **Docs:** `MASTER_KEY` optional in `.env.example`, `docker/docker-compose.example.yml`, the landing compose and `apps/docs/docs/configuration/server-runtime.md` (rotation, `MASTER_KEY_PREVIOUS`, key file path, back up database and volume together, one process per database); upgrade notes and `apps/docs/docs/release-notes/0.28.0-beta.md`.
