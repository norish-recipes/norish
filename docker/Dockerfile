##############################
# Base image (minimal, no pnpm needed at runtime)
##############################
FROM node:25-alpine@sha256:26ded7f450a0ad37241d2ae97ea521a59cb551a1785c8a950f74b0a291ad3aea AS base

RUN apk add --no-cache ca-certificates libc6-compat

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

##############################
# Builder base with pnpm (only for build stages)
##############################
FROM base AS builder-base

RUN npm install -g pnpm@10.11.0

##############################
# All Dependencies (for build)
##############################
FROM builder-base AS deps

RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev

COPY package.json pnpm-lock.yaml .npmrc ./

RUN pnpm install --frozen-lockfile

##############################
# Production Dependencies ONLY
##############################
FROM builder-base AS prod-deps

# Need build tools for native modules (sharp, pg, heic-convert)
RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev vips-dev

COPY package.json pnpm-lock.yaml .npmrc ./

# Tell sharp to use system libvips
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=0

RUN pnpm fetch --prod
RUN pnpm install --prod --offline --frozen-lockfile --recursive

# Install production deps, then remove wrong-platform binaries
RUN set -eux; cd node_modules/.pnpm; \
    find . -maxdepth 1 -type d -name "@next+swc-*" \
      ! -name "*linux-x64-musl*" \
      ! -name "*linux-arm64-musl*" \
      -exec rm -rf {} +; \
    find . -maxdepth 1 -type d -name "@img+sharp-*" \
      ! -name "*linuxmusl-x64*" \
      ! -name "*linuxmusl-arm64*" \
      -exec rm -rf {} +; \
    find . -maxdepth 1 -type d -name "@img+sharp-libvips-*" \
      ! -name "*linuxmusl-x64*" \
      ! -name "*linuxmusl-arm64*" \
      -exec rm -rf {} +;

##############################
# Build stage
##############################
FROM builder-base AS build

RUN apk add --no-cache python3 make g++ pkgconfig libpq-dev

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    SKIP_ENV_VALIDATION=1

RUN pnpm run build && \
    rm -rf .next/cache .next/trace

##############################
# Runtime stage (minimal, no pnpm)
##############################
FROM base AS runtime

ARG YT_DLP_VERSION=2025.11.12

# PostgreSQL client lib + ffmpeg + vips (for sharp) - runtime only, no -dev packages
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

# Create non-root user with configurable UID/GID (always ensure norish exists)
ARG UID=1000
ARG GID=1000

RUN addgroup -g ${GID} -S norishapp || true && \
    adduser  -u ${UID} -S norish -G norishapp || true

# Copy Next.js standalone output (includes minimal node_modules for Next.js itself)
COPY --from=build --chown=${UID}:${GID} /app/.next/standalone ./

# Copy static assets
COPY --from=build --chown=${UID}:${GID} /app/.next/static ./.next/static
COPY --from=build --chown=${UID}:${GID} /app/public ./public

# Copy compiled backend and configs
COPY --from=build --chown=${UID}:${GID} /app/dist-server ./dist-server
COPY --from=build --chown=${UID}:${GID} /app/config ./config
COPY --from=build --chown=${UID}:${GID} /app/server/db ./server/db
COPY --from=build --chown=${UID}:${GID} /app/server/ai/prompts ./server/ai/prompts

# Copy pruned production node_modules (overwrites/merges with standalone's minimal deps)
COPY --from=prod-deps --chown=${UID}:${GID} /app/node_modules ./node_modules

# Create uploads, video temp, and binaries directories
RUN mkdir -p /app/uploads/recipes /app/uploads/avatars /app/uploads/video-temp /app/bin && \
    chown -R ${UID}:${GID} /app/uploads /app/bin

# Download yt-dlp standalone binary during build (architecture-specific for Alpine/musl)
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      YT_DLP_BINARY="yt-dlp_musllinux_aarch64"; \
    else \
      YT_DLP_BINARY="yt-dlp_musllinux"; \
    fi && \
    wget -q "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/${YT_DLP_BINARY}" -O /app/bin/yt-dlp && \
    chmod +x /app/bin/yt-dlp

USER norish

EXPOSE 3000

VOLUME ["/app/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', r => process.exit(r.statusCode===200?0:1))" || exit 1

# Run directly with node
CMD ["node", "dist-server/server.cjs"]
