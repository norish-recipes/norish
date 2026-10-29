# syntax=docker/dockerfile:1.26

##############################
# Base image (minimal, no pnpm needed at runtime)
##############################
FROM node:26.13.0-alpine3.24 AS base

# Security: upgrade all packages to latest versions to fix CVEs
RUN apk upgrade --no-cache && \
  apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

##############################
# Builder base with pnpm (only for build stages)
##############################
FROM base AS builder-base

RUN --mount=type=bind,source=package.json,target=/tmp/package.json \
  npm install -g "$(node -p "require('/tmp/package.json').packageManager")"

# The store lives on a cache mount, so pnpm cannot hard link from it into /app.
# Named explicitly, pnpm copies from it instead of starting a second store
# inside node_modules.
ENV PNPM_CONFIG_STORE_DIR=/root/.local/share/pnpm/store

COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /uvx /bin/

ENV UV_LINK_MODE=copy \
  UV_PYTHON_DOWNLOADS=0 \
  UV_PYTHON_INSTALL_DIR=/app/.uv/python

##############################
# All Dependencies (for build)
##############################
FROM builder-base AS deps

# Every workspace manifest, wherever it sits: a new workspace needs no line here.
COPY --parents package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json \
  apps/*/package.json packages/*/package.json tooling/*/package.json \
  tooling/tailwind/heroui-theme.css tooling/tailwind/heroui-theme.js \
  tooling/tailwind/postcss-config.js ./

# ffmpeg-static's install script downloads a binary only development uses;
# the image runs Alpine's ffmpeg.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  SKIP_PARSER_API_INSTALL=1 pnpm install --frozen-lockfile --allow-build '!ffmpeg-static'

##############################
# Build stage
##############################
FROM builder-base AS build

ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

RUN --mount=type=cache,target=/root/.local/share/uv/python \
  UV_PYTHON_DOWNLOADS=1 uv python install

# Only the root node_modules comes over from the deps stage, and the repo copy
# leaves out every other node_modules: this install recreates the nested ones
# under packages/* and apps/* from the store.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts --child-concurrency=1

RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=cache,target=/root/.local/share/uv/python \
  UV_PYTHON_DOWNLOADS=0 uv sync --project /app/apps/parser-api --locked && \
  # The test suites the parser's packages ship load at no point.
  find /app/apps/parser-api/.venv/lib -type d -path '*/site-packages/*/tests' -prune -exec rm -rf {} +

# What the parser never loads from the Python it runs on: the shared library
# (the interpreter is linked statically, so nothing links it), Tk and its
# demos, IDLE, the bundled pip and its installer, and the C headers.
RUN cd /app/.uv/python/cpython-* && \
  rm -rf lib/libpython3*.so* include share lib/tcl* lib/tk* lib/itcl* lib/thread* \
  lib/python3.*/tkinter lib/python3.*/idlelib lib/python3.*/turtledemo \
  lib/python3.*/ensurepip lib/python3.*/site-packages/pip* \
  lib/python3.*/lib-dynload/_tkinter*

# NODE_ENV matches what CI exports around the same `pnpm run build` (and turbo
# passes it through to every package build), so the image build can never
# silently diverge from the build the gates tested. `next build` forces
# production internally either way; this pins the rest of the task graph.
ENV NODE_ENV=production \
  DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
  SKIP_ENV_VALIDATION=1

# The image takes .next as it is, less what only the build and the tracer
# read: the caches, the type output, source maps and the trace files.
RUN pnpm run build && \
  rm -rf apps/web/.next/cache apps/web/.next/trace \
  apps/web/.next/dev apps/web/.next/diagnostics apps/web/.next/types && \
  find apps/web/.next -type f \( -name '*.map' -o -name '*.nft.json' \) -delete

# Create the production deployment with pnpm deploy, isolated like every
# other install: node_modules/.pnpm is the store, and every package, the
# @norish/* workspace copies included, loads its own dependencies from it. It
# installs the versions pnpm-lock.yaml records.
RUN pnpm deploy --filter @norish/web --prod /app/deploy && \
  cd /app/deploy/node_modules/.pnpm && \
  # Build-time packages that reach the production closure through required
  # peers: TypeScript as tRPC's, and Babel, type declarations and Tailwind with
  # them. The server runs through tsx and esbuild, so those two stay.
  rm -rf typescript@* @babel+* @types+* tailwindcss@* @tailwindcss+* \
  # SWC compiles only during next build.
  @next+swc-* && \
  # Next's ESM build, its docs and its development runtimes: the production
  # server loads the CommonJS build alone.
  rm -rf next@*/node_modules/next/dist/esm next@*/node_modules/next/dist/docs && \
  find next@*/node_modules/next -name '*.runtime.dev.js' -delete && \
  # Source maps, type declarations and documentation load at no point, nor do
  # the test suites and test helpers packages ship (`ai/test` among them).
  find /app/deploy/node_modules -type f \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.mts' \
  -o -name '*.d.cts' -o -name '*.md' \) -delete && \
  find /app/deploy/node_modules/.pnpm -type d \( -name test -o -name tests -o -name __tests__ \) \
  -prune -exec rm -rf {} +

# Then every store folder nothing reaches any more. The walk starts at the
# deploy's top-level links and follows each package's dependencies, optional
# dependencies and required peers, never an optional peer: pnpm fills one
# whenever the workspace has it (drizzle-kit for Better Auth, Playwright and
# the React Compiler for Next), but the package runs without it. A folder
# removed above counts as absent, so what only it needed goes too.
RUN node --input-type=module <<'EOF'
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join, sep } from "node:path";

const root = "/app/deploy/node_modules";
const store = join(root, ".pnpm");
const reached = new Set();
const visit = (link) => {
  if (!existsSync(link)) return;
  const dir = realpathSync(link);
  if (dir.startsWith(store + sep)) reached.add(dir);
};

for (const entry of readdirSync(root).filter((name) => !name.startsWith("."))) {
  const scoped = entry.startsWith("@") ? readdirSync(join(root, entry)) : null;
  for (const name of scoped ? scoped.map((n) => `${entry}/${n}`) : [entry]) visit(join(root, name));
}

// A Set iterates what is added while it iterates, so this walks to the end.
for (const dir of reached) {
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const optionalPeer = (name) => manifest.peerDependenciesMeta?.[name]?.optional;
  // A package's dependencies are linked beside it in its store folder.
  const siblings = dir.slice(0, dir.lastIndexOf(`${sep}node_modules${sep}`) + "/node_modules".length);
  for (const name of [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}).filter((name) => !optionalPeer(name)),
  ])
    visit(join(siblings, name));
}

const kept = new Set([...reached].map((dir) => dir.slice(store.length + 1).split(sep)[0]));
const removed = readdirSync(store).filter(
  (folder) => folder !== "node_modules" && folder !== "lock.yaml" && !kept.has(folder)
);
for (const folder of removed) rmSync(join(store, folder), { recursive: true, force: true });
console.log(`removed ${removed.length} unreached store folders: ${removed.join(" ")}`);
EOF

# The deployed @norish/* copies are the only copy of the workspace code: their
# build configs and type output (dist holds declarations only) go, and
# /app/packages/<dir> keeps just package.json and a src link into the copy, so
# the data read from packages/<dir>/src (prompts, migrations, the icon set)
# resolves from /app as before. The links resolve once the deploy sits at
# /app/node_modules.
RUN for copy in /app/deploy/node_modules/.pnpm/*/node_modules/@norish/*; do \
  rm -rf "$copy/dist" && \
  find "$copy" -type f \( -name 'vitest.config.*' -o -name 'tsconfig*.json' -o -name 'eslint.config.*' \
  -o -name 'turbo.json' \) -delete; \
  done && \
  for dir in /app/packages/*/; do \
  name=$(node -p "require('${dir}package.json').name") && \
  copy=$(cd /app/deploy && ls -d node_modules/.pnpm/$(echo $name | tr / +)@*/node_modules/$name 2>/dev/null | head -1) && \
  if [ -n "$copy" ]; then \
  mkdir -p "/app/runtime-packages/$(basename $dir)" && \
  cp "${dir}package.json" "/app/runtime-packages/$(basename $dir)/" && \
  ln -s "../../$copy/src" "/app/runtime-packages/$(basename $dir)/src"; \
  fi; \
  done

##############################
# yt-dlp download (cached separately from app build)
##############################
FROM base AS ytdlp

# Keep in step with DEFAULT_YT_DLP_VERSION in packages/config/src/zod/server-config.ts:
# this is the binary the image actually ships, and that constant is the version
# the server reports for it.
ARG YT_DLP_VERSION=2026.10.26
ARG TARGETARCH

RUN apk add --no-cache curl

RUN if [ "$TARGETARCH" = "arm64" ]; then \
  YT_DLP_BINARY="yt-dlp_musllinux_aarch64"; \
  else \
  YT_DLP_BINARY="yt-dlp_musllinux"; \
  fi && \
  mkdir -p /ytdlp && \
  curl --fail --silent --show-error \
  --location \
  --retry 5 \
  --retry-all-errors \
  --retry-delay 3 \
  "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${YT_DLP_BINARY}" \
  --output /ytdlp/yt-dlp && \
  chmod +x /ytdlp/yt-dlp

##############################
# Runtime stage (minimal, no pnpm)
##############################
FROM base AS runtime

LABEL org.opencontainers.image.source="https://github.com/norish-recipes/norish"

# Install runtime-only system deps (base already ran apk upgrade)
RUN apk add --no-cache ffmpeg su-exec && \
  # Clean up npm (not needed, we use node directly)
  rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
  rm -rf /var/cache/apk/* /tmp/* /root/.npm

WORKDIR /app

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  SKIP_ENV_VALIDATION=0 \
  PORT=3000 \
  HOST="0.0.0.0"

ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

ARG NORISH_VERSION_REPORT_JSON

RUN test -n "${NORISH_VERSION_REPORT_JSON}"

ENV NORISH_VERSION_REPORT_JSON=${NORISH_VERSION_REPORT_JSON}

# Use non-root user for runtime.
# The node image already has user 'node' with UID/GID 1000.
# For custom UID/GID, create a new user; otherwise reuse 'node'.
ARG UID=1000
ARG GID=1000

RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
  addgroup -g ${GID} -S norishapp 2>/dev/null; \
  adduser -u ${UID} -S norish -G $(getent group ${GID} | cut -d: -f1) 2>/dev/null; \
  fi

# --- Minimal Next.js runtime files for the custom server ---
# The custom server runs from source, so only the built `.next` output comes
# over: it reads Next's config from .next/required-server-files.json.
COPY --from=build --chown=${UID}:${GID} /app/apps/web/.next/ ./apps/web/.next/

# --- Production node_modules from pnpm deploy (complete runtime deps) ---
# It stays at /app/node_modules: Next's links in .next/node_modules (pg, pino,
# sharp) point at ../../../../node_modules/.pnpm/…, which resolves only from here.
COPY --from=build --chown=${UID}:${GID} /app/deploy/node_modules/ ./node_modules/

# --- Public assets and the parser ---
COPY --from=build --chown=${UID}:${GID} /app/apps/web/public/ ./apps/web/public/
COPY --from=build --chown=${UID}:${GID} /app/apps/parser-api/ ./apps/parser-api/
COPY --from=build --chown=${UID}:${GID} /app/.uv/python/ /app/.uv/python/

# --- Custom server, run from source through tsx ---
# Its package.json says "type": "module". No tsconfig.json comes over: from
# /app or /app/apps/web, tsx would apply apps/web's @norish/queue/* path alias
# into /app/packages and load a second queue registry.
COPY --from=build --chown=${UID}:${GID} /app/apps/web/server/ ./apps/web/server/
COPY --from=build --chown=${UID}:${GID} /app/apps/web/package.json ./apps/web/package.json

# --- Workspace packages: package.json and a src link into the deployed copy ---
# The code runs from node_modules; the links serve the data files read from
# packages/<dir>/src (AI prompts, migrations, the icon set).
COPY --from=build --chown=${UID}:${GID} /app/runtime-packages/ ./packages/

# Create upload and bin parent directories only.
# Subdirectories (recipes/, avatars/, video-temp/) are created on-demand
RUN mkdir -p /app/uploads /app/bin && \
  chown -R ${UID}:${GID} /app/uploads /app/bin

# Copy pre-downloaded yt-dlp binary from dedicated build stage
COPY --from=ytdlp --chown=${UID}:${GID} /ytdlp/yt-dlp /app/bin/yt-dlp

# The container starts as root only so the entrypoint can hand the uploads
# folder to this user; the server itself runs as it.
ENV NORISH_UID=${UID} \
  NORISH_GID=${GID}

COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/norish-entrypoint

EXPOSE 3000

VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000' + (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/api/v1/health/live', r => process.exit(r.statusCode===200?0:1))" || exit 1

ENTRYPOINT ["norish-entrypoint"]

# Run directly with node; the custom server starts the embedded parser API when needed
CMD ["node", "--import", "tsx", "/app/apps/web/server/index.ts"]
