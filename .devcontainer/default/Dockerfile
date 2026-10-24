FROM mcr.microsoft.com/devcontainers/javascript-node:5-26-bookworm

RUN apt-get update \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends openssl postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*