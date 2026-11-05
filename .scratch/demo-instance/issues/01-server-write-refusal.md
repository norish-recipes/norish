# 01: Server refuses writes on a Demo Instance

**What to build:** a `DEMO_MODE` env flag in `packages/config/src/env-config-server.ts`, off by default. When it is on:

- a middleware on `publicProcedure` (`packages/trpc/src/trpc.ts`) refuses every `type === "mutation"` with `FORBIDDEN` and a demo-specific code. That covers the app, FormData uploads and the `/api/v1` Public API, which all run through tRPC;
- Better Auth lets only email sign-in, sign-out and session reads through. Sign-up, password change, link/unlink sign-in method and every other write endpoint answer with the same refusal.

See `.scratch/demo-instance/spec.md`.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] tRPC test: a mutation is refused with the demo code under the flag, a query still answers, both pass with the flag off
- [ ] Public API test: a v1 POST is refused under the flag
- [ ] Auth test: email sign-in and sign-out work under the flag, change-password and sign-up are refused
- [ ] Gates green: lint, typecheck, test:run, i18n:check, build
