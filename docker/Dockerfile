##############################
# Base image (minimal, no pnpm needed at runtime)
##############################
FROM node:25-alpine3.21 AS base

# Security: upgrade all packages to latest versions to fix CVEs
RUN apk upgrade --no-cache && \
    apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

##############################
# Builder base with pnpm (only for build stages)
##############################
FROM base AS builder-base

RUN npm install -g pnpm@10.30.1

##############################
# All Dependencies (for build)
##############################
FROM builder-base AS deps

RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev vips-dev

# Tell sharp to use system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY apps/web/package.json ./apps/web/package.json

# packages/*
COPY packages/api/package.json ./packages/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/i18n/package.json ./packages/i18n/package.json
COPY packages/queue/package.json ./packages/queue/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/shared-react/package.json ./packages/shared-react/package.json
COPY packages/shared-server/package.json ./packages/shared-server/package.json
COPY packages/trpc/package.json ./packages/trpc/package.json
COPY packages/ui/package.json ./packages/ui/package.json

# tooling/*
COPY tooling/eslint/package.json ./tooling/eslint/package.json
COPY tooling/prettier/package.json ./tooling/prettier/package.json
COPY tooling/tailwind/package.json ./tooling/tailwind/package.json
COPY tooling/typescript/package.json ./tooling/typescript/package.json

# patches (required for patchedDependencies in pnpm-workspace.yaml)
COPY patches/ ./patches/

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

##############################
# Build stage
##############################
FROM builder-base AS build

# Native build deps are already compiled in node_modules from deps stage.
# Only re-install if pnpm deploy triggers native rebuilds.
RUN apk add --no-cache pkgconfig libpq-dev vips-dev

WORKDIR /app

ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    SKIP_ENV_VALIDATION=1

RUN pnpm run build && \
    rm -rf apps/web/.next/cache apps/web/.next/trace \
           apps/web/.next/dev apps/web/.next/diagnostics apps/web/.next/types && \
    rm -rf apps/web/.next/standalone/node_modules/typescript \
           apps/web/.next/standalone/node_modules/ffmpeg-static

# Create isolated production deployment with pnpm deploy.
# This gives us a minimal node_modules with only @norish/web's runtime deps.
# Remove mobile-only patch reference first.
RUN sed -i '/expo-widgets/d' pnpm-workspace.yaml && \
    pnpm deploy --legacy --filter @norish/web --prod /app/deploy && \
    cd /app/deploy/node_modules && \
    # Remove duplicated workspace packages (we copy packages/ separately)
    rm -rf @norish && \
    # Remove build-only tools that leak through transitive deps
    rm -rf typescript @esbuild esbuild tsx \
           @prisma prisma drizzle-kit \
           eslint @eslint @typescript-eslint eslint-* \
           prettier prettier-plugin-* \
           @tailwindcss tailwindcss postcss postcss-* \
           vitest @vitest @testing-library jsdom \
           @babel babel-plugin-* babel-preset-* \
           jest-* @jest fast-check axe-core \
           rollup terser \
           turbo turbo-* && \
    # Remove packages superseded by system binaries (apk add ffmpeg)
    rm -rf ffmpeg-static && \
    # Remove wrong-platform binaries
    rm -rf @next/swc-darwin-* @next/swc-win32-* @next/swc-linux-x64-gnu \
           @swc/core-darwin-* @swc/core-win32-* @swc/core-linux-x64-* \
           @img/sharp-darwin-* @img/sharp-win32-* @img/sharp-linux-x64 \
           @img/sharp-libvips-darwin-* @img/sharp-libvips-win32-* @img/sharp-libvips-linux-x64 \
           lightningcss-darwin-* lightningcss-win32-* lightningcss-linux-x64-gnu \
           @next/eslint-plugin-next

# Strip test files and dev configs from packages/ before they get copied to runtime.
# This avoids shipping test fixtures, vitest configs, and TS build configs.
RUN find /app/packages -type d -name '__tests__' -exec rm -rf {} + 2>/dev/null; \
    find /app/packages -type f \( \
      -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \
      -o -name 'vitest.config.*' -o -name 'tsconfig*.json' -o -name 'eslint.config.*' \
    \) -delete 2>/dev/null; \
    true

##############################
# yt-dlp download (cached separately from app build)
##############################
FROM base AS ytdlp

ARG YT_DLP_VERSION=2026.02.04
ARG TARGETARCH

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      YT_DLP_BINARY="yt-dlp_musllinux_aarch64"; \
    else \
      YT_DLP_BINARY="yt-dlp_musllinux"; \
    fi && \
    mkdir -p /ytdlp && \
    wget -q "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${YT_DLP_BINARY}" -O /ytdlp/yt-dlp && \
    chmod +x /ytdlp/yt-dlp

##############################
# Runtime stage (minimal, no pnpm)
##############################
FROM base AS runtime

LABEL org.opencontainers.image.source="https://github.com/norish-recipes/norish"

# Install runtime-only system deps (base already ran apk upgrade)
RUN apk add --no-cache libpq ffmpeg vips && \
    # Clean up npm (not needed, we use node directly)
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
    rm -rf /var/cache/apk/* /tmp/* /root/.npm

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=0 \
    PORT=3000 \
    HOST="0.0.0.0"

# Use non-root user for runtime.
# node:25-alpine already has user 'node' with UID/GID 1000.
# For custom UID/GID, create a new user; otherwise reuse 'node'.
ARG UID=1000
ARG GID=1000

RUN if [ "${UID}" != "1000" ] || [ "${GID}" != "1000" ]; then \
      addgroup -g ${GID} -S norishapp 2>/dev/null; \
      adduser -u ${UID} -S norish -G $(getent group ${GID} | cut -d: -f1) 2>/dev/null; \
    fi

# --- Next.js standalone output (app structure + traced deps) ---
COPY --from=build --chown=${UID}:${GID} /app/apps/web/.next/standalone/ ./
# Root package.json needed by next.config.js (reads version from ../../package.json)
COPY --from=build --chown=${UID}:${GID} /app/package.json ./package.json

# --- Production node_modules from pnpm deploy (complete runtime deps) ---
COPY --from=build --chown=${UID}:${GID} /app/deploy/node_modules/ ./node_modules/

# --- Static + public assets (not included in standalone trace) ---
COPY --from=build --chown=${UID}:${GID} /app/apps/web/.next/static/ ./apps/web/.next/static/
COPY --from=build --chown=${UID}:${GID} /app/apps/web/public/ ./apps/web/public/

# --- Custom server entry point (@norish/* code is compiled into this bundle) ---
COPY --from=build --chown=${UID}:${GID} /app/dist-server/ ./dist-server/

# --- Workspace packages: runtime data files (AI prompts, migrations, etc.) ---
# The @norish/* TypeScript code is compiled into dist-server, but some packages
# contain runtime data files (e.g. .txt prompt templates) read from disk.
COPY --from=build --chown=${UID}:${GID} /app/packages/ ./packages/

# Create upload and bin parent directories only.
# Subdirectories (recipes/, avatars/, video-temp/) are created on-demand
RUN mkdir -p /app/uploads /app/bin && \
    chown -R ${UID}:${GID} /app/uploads /app/bin

# Copy pre-downloaded yt-dlp binary from dedicated build stage
COPY --from=ytdlp --chown=${UID}:${GID} /ytdlp/yt-dlp /app/bin/yt-dlp

USER ${UID}

EXPOSE 3000

VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode===200?0:1))" || exit 1

# Run directly with node
CMD ["node", "dist-server/index.mjs"]
