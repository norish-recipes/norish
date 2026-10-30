<p align="center"><a href="https://norish.dev"><img src=".github/assets/readme/link-top-website.png" width="20%" align="top" alt="Website"></a><a href="https://docs.norish.dev"><img src=".github/assets/readme/link-top-docs.png" width="20%" align="top" alt="Docs"></a><a href="https://github.com/norish-recipes/Norish/blob/main/LICENSE"><img src=".github/assets/readme/link-top-license.png" width="20%" align="top" alt="License: AGPL-3.0"></a><a href="https://hub.docker.com/r/norishapp/norish"><img src=".github/assets/readme/link-top-docker.png" width="20%" align="top" alt="Docker Hub"></a><a href="https://buymeacoffee.com/mikevanes"><img src=".github/assets/readme/link-top-coffee.png" width="20%" align="top" alt="Buy me a coffee"></a><img src=".github/assets/readme/hero.png" width="100%" align="top" alt="Norish. Any source, any recipe. Import from recipe sites, YouTube, Instagram, photos and pasted text."><a href="#quick-start"><img src=".github/assets/readme/quickstart.png" width="100%" align="top" alt="Set it up using Docker Compose. Jump to the quick start."></a><img src=".github/assets/readme/duo.png" width="100%" align="top" alt="Scale any recipe: change the servings or switch between US and metric. Focus on cooking: timers, the ingredients each step needs, and the screen stays on."><img src=".github/assets/readme/trio.png" width="100%" align="top" alt="Plan the week in one shared meal calendar, do the groceries on a list synced in real time, and skip what is already in your pantry."><img src=".github/assets/readme/selfhost.png" width="100%" align="top" alt="Free and open source. Works offline, sign in with OIDC, GitHub, Google or email, and 17 languages."><a href="https://norish.dev"><img src=".github/assets/readme/link-website.png" width="20%" align="top" alt="Website"></a><a href="https://docs.norish.dev"><img src=".github/assets/readme/link-docs.png" width="20%" align="top" alt="Docs"></a><a href="https://github.com/norish-recipes/Norish/blob/main/LICENSE"><img src=".github/assets/readme/link-license.png" width="20%" align="top" alt="License: AGPL-3.0"></a><a href="https://hub.docker.com/r/norishapp/norish"><img src=".github/assets/readme/link-docker.png" width="20%" align="top" alt="Docker Hub"></a><a href="https://buymeacoffee.com/mikevanes"><img src=".github/assets/readme/link-coffee.png" width="20%" align="top" alt="Buy me a coffee"></a></p>

<a name="quick-start"></a>
<p><img src=".github/assets/readme/quickstart-head.png" width="100%" align="top" alt="Quick start: save the file below as compose.yaml, set the two secrets and run docker compose up -d"></p>

Generate `MASTER_KEY` with `openssl rand -base64 32` and keep it stable: it derives the encryption keys.

```yaml
services:
  norish:
    image: norishapp/norish:latest
    container_name: norish-app
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - norish_data:/app/uploads
    environment:
      AUTH_URL: http://localhost:3000
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: <32-byte-base64-key> # openssl rand -base64 32
      OBSCURA_ENDPOINT: ws://obscura:9222
      OBSCURA_CDP_TOKEN: <random-token> # openssl rand -hex 32, same value on obscura
      VALKEY_URL: valkey://valkey:6379
      UPLOADS_DIR: /app/uploads
      
    healthcheck:
      test:
        [
          "CMD-SHELL",
          'node -e "require(''http'').get(''http://localhost:3000'' + (process.env.NEXT_PUBLIC_BASE_PATH || '''') + ''/api/v1/health/live'', r => process.exit(r.statusCode===200?0:1))"',
        ]
      interval: 1m
      timeout: 15s
      retries: 3
      start_period: 1m
    depends_on:
      - db
      - valkey

  db:
    image: postgres:17-alpine
    container_name: norish-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: norish
      POSTGRES_DB: norish
    volumes:
      - db_data:/var/lib/postgresql/data

  # Renders recipe pages for URL imports
  obscura:
    image: norishapp/obscura:0.2.5-norish.1
    container_name: norish-obscura
    restart: unless-stopped
    environment:
      OBSCURA_CDP_TOKEN: <random-token>

  valkey:
    image: valkey/valkey:9
    container_name: norish-valkey
    restart: unless-stopped
    volumes:
      - valkey_data:/data

volumes:
  db_data:
  norish_data:
  valkey_data:
```

<p><a href="https://docs.norish.dev"><img src=".github/assets/readme/quickstart-foot.png" width="100%" align="top" alt="Reverse proxy, sign-in providers and AI are in the docs. Setup guide."></a></p>

<p><img src=".github/assets/readme/outro.png" width="100%" align="top" alt="Contributions welcome. If you don't have any programming skills, making issues is appreciated and helps make Norish a better app. Norish is free software under AGPL-3.0. Last but not least, our dog Nora."><a href="https://github.com/norish-recipes/Norish/blob/main/CONTRIBUTING.md"><img src=".github/assets/readme/link-contributing.png" width="50%" align="top" alt="Contributing guide"></a><a href="https://docs.norish.dev/development/setup"><img src=".github/assets/readme/link-dev-setup.png" width="50%" align="top" alt="Development setup"></a></p>
