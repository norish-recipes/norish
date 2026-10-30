# 08: Norish's Chromium image

**What to build:** Norish publishes `norishapp/chromium`, a stealth Chromium an administrator can uncomment in Compose and point the Chromium browser at. It repackages a pinned fingerprint-chromium (BSD-3) Linux x86_64 release on Debian slim, the way the Obscura image repackages its release. It is amd64 only, because upstream publishes no arm64 Linux build. Spec: `.scratch/chromium-browser-renderer/spec.md` (The Chromium image; Further Notes).

**Blocked by:** 06.

**Status:** ready-for-agent

**The image**
- [x] A `docker/chromium` directory mirrors `docker/obscura`: a Dockerfile, a `pin.env` recording the release and the image tag together, and a README of a few lines.
- [x] The container runs:
  - new headless mode;
  - a random `--fingerprint` seed per start;
  - a non-root user;
  - its own profile directory;
  - the DevTools port forwarded by socat.
- [x] A publish workflow modelled on the Obscura image workflow builds amd64 only and refuses to overwrite an existing tag.

**Compose and docs**
- [x] The Compose example has a commented-out `chromium` service with `shm_size`, beside the solver alternatives, and the matching commented `CHROMIUM_BROWSER_ENDPOINT` line on the norish service. Obscura stays on by default.
- [x] The apps/docs Page Renderer section covers the Chromium browser:
  - the image and its licence;
  - amd64 only;
  - the endpoint format;
  - that any other Chromium CDP endpoint works too.

**Hand test**
- [ ] Mike tests the image by hand before release:
  - an Allerhande recipe import;
  - a site needing a cookie token, and one needing a header token;
  - a public URL redirecting to a private address, refused;
  - the container restarting while imports run.
