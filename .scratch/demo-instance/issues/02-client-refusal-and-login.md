# 02: Client refusal toast and prefilled login

**What to build:** the web client learns from the server that it is on a Demo Instance (through the existing server config the client already reads, not a build-time variable).

- A tRPC link placed ahead of the Outbox's `mutationLink` in `packages/shared-react/src/providers/trpc-links.ts` refuses every mutation before it leaves and shows the toast "This is a read-only demo." Nothing is queued and no optimistic state is applied. Every button stays enabled.
- A server refusal with the demo code (01) shows the same toast, so a write the link misses still reads the same.
- The email/password form (`apps/web/features/auth/components/email-password-form.tsx`) comes prefilled with `demo@norish.app` / `demodemo`.

See `.scratch/demo-instance/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Unit test: the link refuses mutations and passes queries under the flag
- [ ] E2E: on a Demo Instance, sign in with the prefilled form, tick a grocery, see the toast, the item stays unticked and the Outbox is empty
- [ ] Toast string in every locale
- [ ] Gates green: lint, typecheck, test:run, i18n:check, build
