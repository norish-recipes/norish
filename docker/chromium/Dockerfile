# syntax=docker/dockerfile:1.26

# fingerprint-chromium, which reads pages Obscura is bot-checked on. Upstream ships x86_64 Linux
# archives only, so the pinned one is unpacked onto Debian slim, amd64 only; ARGs mirror pin.env.

ARG CHROMIUM_REPO=https://github.com/adryfish/fingerprint-chromium
ARG CHROMIUM_VERSION=150.0.7871.186
ARG CHROMIUM_ARCHIVE=ungoogled-chromium-150.0.7871.186-1-x86_64_linux.tar.xz
ARG CHROMIUM_SHA256=48eff860053efd9ad498d51370f0a1f59f983df39c02a72ad2a8682cdead4055

FROM debian:13-slim AS fetch

ARG CHROMIUM_REPO
ARG CHROMIUM_VERSION
ARG CHROMIUM_ARCHIVE
ARG CHROMIUM_SHA256

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /out

# Release assets can be replaced after the fact, so the digest is pinned too.
# chromedriver and the desktop launcher are not needed to serve CDP.
RUN set -eux; \
    curl -fsSL -o chromium.tar.xz \
        "${CHROMIUM_REPO}/releases/download/${CHROMIUM_VERSION}/${CHROMIUM_ARCHIVE}"; \
    echo "${CHROMIUM_SHA256}  chromium.tar.xz" | sha256sum -c -; \
    mkdir chromium; \
    tar xJf chromium.tar.xz -C chromium --strip-components=1; \
    rm chromium.tar.xz chromium/chromedriver chromium/chrome-wrapper

# BSD-3 asks binary copies to carry the notice: fingerprint-chromium's and Chromium's, from the
# matching tags. The third-party notices are built into the binary at chrome://credits.
RUN set -eux; \
    mkdir licenses; \
    curl -fsSL -o licenses/LICENSE \
        "https://raw.githubusercontent.com/${CHROMIUM_REPO#https://github.com/}/${CHROMIUM_VERSION}/LICENSE"; \
    curl -fsSL "https://chromium.googlesource.com/chromium/src/+/refs/tags/${CHROMIUM_VERSION}/LICENSE?format=TEXT" \
        | base64 -d > licenses/LICENSE.chromium

FROM debian:13-slim

ARG CHROMIUM_REPO
ARG CHROMIUM_VERSION

LABEL org.opencontainers.image.title="Norish Chromium" \
      org.opencontainers.image.description="fingerprint-chromium serving CDP, as shipped by Norish for URL imports." \
      org.opencontainers.image.version="${CHROMIUM_VERSION}" \
      org.opencontainers.image.source="${CHROMIUM_REPO}" \
      org.opencontainers.image.url="https://github.com/norish-recipes/Norish" \
      org.opencontainers.image.licenses="BSD-3-Clause"

# What `ldd chrome` and `ldd libGLESv2.so` ask for, plus socat.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libasound2t64 \
        libatk-bridge2.0-0t64 \
        libatk1.0-0t64 \
        libatspi2.0-0t64 \
        libcairo2 \
        libcups2t64 \
        libdbus-1-3 \
        libexpat1 \
        libgbm1 \
        libglib2.0-0t64 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        socat \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --shell /usr/sbin/nologin chromium

COPY --from=fetch /out/chromium /opt/chromium
COPY --from=fetch /out/licenses /licenses/fingerprint-chromium

# socat forwards 9222 to DevTools, which Chromium binds to loopback; each start has a fresh profile.
# --no-sandbox: Docker's default seccomp refuses Chromium's sandbox; the container is the boundary.
COPY --chmod=755 <<'EOF' /usr/local/bin/start-chromium
#!/bin/bash
set -euo pipefail

profile=/tmp/chromium-profile
rm -rf "$profile"
seed=$(shuf -i 1-2147483647 -n 1)
echo "Starting Chromium with fingerprint seed $seed"

/opt/chromium/chrome \
    --headless=new \
    --no-sandbox \
    --fingerprint="$seed" \
    --user-data-dir="$profile" \
    --remote-debugging-port=9223 &
socat TCP-LISTEN:9222,fork,reuseaddr TCP:127.0.0.1:9223 &

trap 'exit 0' TERM INT
wait -n
EOF

USER chromium
EXPOSE 9222
ENTRYPOINT ["/usr/local/bin/start-chromium"]
