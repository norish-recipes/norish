# 03 — Migrate deployment and contributor environments

**What to build:** Make the owned Obscura image and `OBSCURA_ENDPOINT` contract consistent across every active machine-readable deployment, development, test, and CI surface.

**Blocked by:** 02 — Cut rendered URL imports over to Obscura

**Status:** ready-for-agent

- [ ] Production and self-hosted Compose definitions replace `chrome-headless` with one consistently named `obscura` service using the immutable image from ticket 01.
- [ ] Test Compose, local development, and development-container definitions start and address the same Obscura service with the same port convention.
- [ ] The application receives `OBSCURA_ENDPOINT` everywhere rendered imports are supported, and its shipped default addresses the standard Obscura service.
- [ ] CI and task environment pass-through use `OBSCURA_ENDPOINT` and contain no `CHROME_WS_ENDPOINT` compatibility setting.
- [ ] Generated Quick Start and deployment configuration examples emit the Obscura service and endpoint rather than the former Chrome service.
- [ ] Obscura's CDP port is reachable by the Norish application without being unnecessarily published as a public host service.
- [ ] No environment launches Obscura with `--allow-private-network`, a plain non-stealth mode, or a Chrome fallback.
- [ ] Chrome-only image references, commands, flags, container names, service dependencies, ports, and shared-memory configuration are removed from active deployment surfaces.
- [ ] Every active Compose definition renders successfully through Docker Compose configuration validation or its existing equivalent.
