<p align="center">
  <img src="./.github/assets/mockup-norish.png" width="100%" alt="Norish mockup" />
</p>

<p align="center">
  <a href="https://norish.dev"><img src="https://img.shields.io/badge/Website-norish.dev-22c55e?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Website" /></a>
  <a href="https://docs.norish.dev"><img src="https://img.shields.io/badge/Docs-docs.norish.dev-22c55e?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentation" /></a>
  <a href="https://github.com/norish-recipes/Norish/blob/main/LICENSE"><img src="https://img.shields.io/github/license/norish-recipes/Norish?style=for-the-badge" alt="License" /></a>
  <a href="https://github.com/norish-recipes/Norish/actions"><img src="https://img.shields.io/github/actions/workflow/status/norish-recipes/Norish/release-build.yml?style=for-the-badge&logo=github" alt="Build Status" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/pulls/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Pulls" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/image-size/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Image Size" /></a>
  <a href="https://buymeacoffee.com/mikevanes"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

---

# Norish

Norish is a real-time, household-first recipe app for planning meals, sharing groceries, and cooking together.

**For the website and documentation see: [norish.dev](https://norish.dev) and [docs.norish.dev](https://docs.norish.dev)**

## 📚 Documentation

Full documentation lives at **[docs.norish.dev](https://docs.norish.dev)**:

- [Quick start](https://docs.norish.dev/quick-start) — get running with Docker Compose

## Quick start

The fastest way to try Norish is Docker Compose. At a minimum you need a `DATABASE_URL` and a `MASTER_KEY`:

> [!TIP]
> Generate a `MASTER_KEY` with `openssl rand -base64 32`. Keep it secret and stable — it derives the encryption keys, so changing it later invalidates previously encrypted data.

```yaml
services:
  norish:
    image: norishapp/norish:latest
    container_name: norish-app
    restart: always
    ports:
      - "3000:3000"
    user: "1000:1000"
    volumes:
      - norish_data:/app/uploads
    environment:
      AUTH_URL: http://localhost:3000
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: <32-byte-base64-key> # openssl rand -base64 32
      CHROME_WS_ENDPOINT: ws://chrome-headless:3000
      REDIS_URL: redis://redis:6379
      UPLOADS_DIR: /app/uploads
      
    healthcheck:
      test:
        [
          "CMD-SHELL",
          'node -e "require(''http'').get(''http://localhost:3000/api/v1/health'', r => process.exit(r.statusCode===200?0:1))"',
        ]
      interval: 1m
      timeout: 15s
      retries: 3
      start_period: 1m
    depends_on:
      - db
      - redis

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

  chrome-headless:
    image: zenika/alpine-chrome:latest
    container_name: chrome-headless
    restart: unless-stopped
    command:
      - "--no-sandbox"
      - "--disable-gpu"
      - "--disable-dev-shm-usage"
      - "--remote-debugging-address=0.0.0.0"
      - "--remote-debugging-port=3000"
      - "--headless"

  redis:
    image: redis:8.4.0
    container_name: norish-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data

volumes:
  db_data:
  norish_data:
  redis_data:
```



## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) or the [development docs](https://docs.norish.dev/development/setup) to get started.

## License

Norish is licensed under [AGPL-3.0](LICENSE).

---

# Nora

Last but not least, a picture of our lovely dog Nora:

<img src="./apps/web/public/nora.jpg" width="25%" alt="Nora" />
