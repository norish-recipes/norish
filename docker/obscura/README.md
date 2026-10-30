# Norish Obscura image

Norish renders JavaScript-heavy recipe pages before parsing them. That rendering
happens in [Obscura](https://github.com/h4ckf0r0day/obscura), a Rust headless
browser that speaks the Chrome DevTools Protocol, running as its own container
beside the application. The Norish server connects to it over
the endpoint set under **Settings => Admin => Page renderers**, and tries it
first; a FlareSolverr-compatible solver can be the second (ADR-0019).

This directory repackages a release into the image the shipped Compose examples
use. The release comes from Norish's fork,
[norish-recipes/obscura](https://github.com/norish-recipes/obscura): upstream's
release built with the patches in its `patches/`, which send header tokens only
to their own site. The fork builds each new upstream release on its own.

## Why not just pull upstream's image

Because it is the wrong build, and nothing says so at runtime.

Obscura's anti-detection behaviour is a `stealth` cargo feature _and_ a
`--stealth` runtime flag. Upstream ships four _release archives_ per platform —
the `-stealth` suffix being the render+stealth build — but only **one Docker
image**, and its own release notes say what that image is: "the default archive
and Docker image include rendering."

Measured against `h4ckf0r0day/obscura:0.2.0` on 2026-08-10: its `/obscura`
binary contains **0 BoringSSL strings**, against 152 in the `-stealth` archive
this image uses — the TLS fingerprinting stack simply is not in there, and its
size sits beside the plain archive's binary rather than the stealth one. Start
it as `serve --stealth` anyway and it prints its normal banner and runs: no
warning, no error, no hint that the flag did nothing. An operator would have
every reason to believe stealth was on.

So this image takes the `-stealth` archive, and makes the whole command its
`ENTRYPOINT` so the CDP server always starts with `--stealth`. There is no plain
mode and no second service.

**If upstream ever publishes a stealth image, delete this directory and pull
theirs.** That is the only thing keeping it alive.

`--allow-private-network` is deliberately absent everywhere. Obscura blocks
loopback, RFC1918 and link-local targets by default — including at DNS
resolution time — and that default is what keeps an authenticated URL import
from reaching the deployment's own network.

Obscura only listens beyond loopback when `OBSCURA_CDP_TOKEN` holds at least 32
bytes, and then every CDP request needs it as a bearer token. Each Compose file
sets the same value on the `obscura` service and on the app, which sends it.

There is no compile here. The build fetches the published `-stealth` archive for
the target architecture and copies the two binaries into `distroless/cc` (glibc
2.36, against a binary built for 2.35).

## The pin

`pin.env` records the upstream release this image repackages and the image tag
Norish publishes it under. The Dockerfile carries the same values as `ARG`
defaults so a bare `docker build docker/obscura` works.

The tag is immutable by convention: the publish workflow refuses to overwrite a
tag that already exists, so an operator's `docker compose pull` can never change
the browser under a running Norish release. Upgrading Obscura is an edit to
`pin.env` and to the Compose surfaces. The push publishes it.

`latest` is the rolling release for operators who want one: the pinned tag
that `main` ships.

## Publishing a new build

The **Publish browser images** workflow (`.github/workflows/browser-images.yml`)
runs on every push to `main` or `rc/**` that changes this directory. It
publishes the pinned tag when the registry doesn't have it yet, building
`linux/amd64` and `linux/arm64` on native runners and assembling the
multi-architecture manifest. A push to `main` then points `latest` at that tag.
A manual run from the Actions tab does the same, and refuses to overwrite a tag
that already exists unless told to.

To move to a newer Obscura:

1. Take the newest release of the fork, set `OBSCURA_VERSION` to it and bump
   `OBSCURA_IMAGE_TAG` in `pin.env`, and the matching `ARG` defaults in
   `Dockerfile`.
2. Push. The rc branch publishes the tag, and the merge to `main` moves
   `latest`.
3. Update the image tag in every Compose surface the repository ships — the
   three Compose files, the root README Quick Start, the docs Quick Start
   component and the landing page:

   ```bash
   git grep -l 'norishapp/obscura:' -- ':!.scratch' \
     ':!apps/docs/versioned_docs' ':!apps/docs/docs/release-notes'
   ```

   Release notes and frozen docs stay excluded on purpose: a shipped release's
   upgrade instructions name the tag _that_ release shipped, and moving them to
   a later tag would make them a lie. `docker/obscura/README.md` shows up too;
   its snippet reads the tag from `pin.env` and needs no edit.

Building it locally is the same build the workflow runs, minus the publish:

```bash
set -a; . docker/obscura/pin.env; set +a
docker build docker/obscura \
  --build-arg "OBSCURA_REPO=$OBSCURA_REPO" \
  --build-arg "OBSCURA_VERSION=$OBSCURA_VERSION" \
  -t "norishapp/obscura:$OBSCURA_IMAGE_TAG"
```

## Licensing

Obscura is Apache-2.0, with no NOTICE file upstream. The image carries its
`LICENSE` and `README.md` (which holds the credits) under `/licenses/obscura/`,
fetched at the release tag, and the build records
`org.opencontainers.image.source`, `.version` and `.licenses` as OCI labels.

One gap worth knowing about: the binaries are statically linked Rust builds
whose dependency tree carries its own attribution requirements (several crates
are MIT, which asks that its notice travel with binary copies). Upstream ships
no bundled third-party licence file with its releases, and we do not have the
source tree to generate one, so the image does not carry one either. Raising it
upstream is the fix.
