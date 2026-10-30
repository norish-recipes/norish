# 04: Allow private addresses

**What to build:** By default, a page fetch can no longer reach a loopback, private or link-local address.
- A household member who imports `http://192.168.1.1/` gets a failure saying that private addresses are not allowed on this instance.
- An administrator with a recipe site on their LAN turns on **Allow private addresses** on the Page Renderers card, and the plain fetch and the solver then reach it.
- Obscura keeps refusing private addresses regardless, so on a LAN site the chain moves on past Obscura.

See `.scratch/page-renderers/spec.md` and ADR-0019.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] One guard in the fetch layer resolves the target hostname with Node's DNS lookup and checks every address against `net.BlockList`, with no new dependency. It covers loopback, RFC1918, link-local, unique-local IPv6 and unspecified. It runs before the plain fetch, at every plain-fetch redirect hop, and before the solver attempt. It does not run before Obscura
- [ ] A refused target returns empty HTML with a log line, and the import failure names the refusal in words a household member understands
- [ ] The switch is on the card, seeded from `ALLOW_PRIVATE_ADDRESSES`, false by default
- [ ] Tests cover:
  - literal private IPs refused;
  - a hostname resolving to a private address refused;
  - a redirect hop that turns private refused;
  - everything allowed with the switch on;
  - public targets unaffected;
  - the solver attempt skipped for a private target
- [ ] The 0.26.0 Upgrade notes say that private addresses are now refused by default and how to allow them, and `.env.example` gains the var
