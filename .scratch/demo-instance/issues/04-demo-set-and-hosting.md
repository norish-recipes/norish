# 04: Build the demo set and host demo.norish.dev

**What to build:**

- On a local instance with the flag off, build the curated household: `demo@norish.app` / `demodemo` as admin, one second member, recipes with images, a planned week, groceries. No AI keys, no OIDC.
- Ship it as a `pg_dump` plus a tarball of the uploads volume. It lives on the VM, not in the repo.
- Oracle Always Free A1 VM (arm64), account upgraded to Pay As You Go so it is not reclaimed for idling.
- The stock compose file with `DEMO_MODE=true`, plus a `cloudflared` container for the Tunnel to `demo.norish.dev`. No inbound ports.
- Nightly cron: `docker compose pull && docker compose up -d` on the stable tag.

See `.scratch/demo-instance/spec.md`.

**Blocked by:** 01, 02, 03 released in a stable image

**Status:** ready-for-human

- [ ] demo.norish.dev signs in with the prefilled form and shows this week's plan
- [ ] A write is refused with the toast
- [ ] `nmap` on the VM's public IP shows no open ports beyond SSH
