<p align="center">
  <img src="./.github/assets/mockup-norish.png" width="100%" alt="Norish mockup" />
</p>

<p align="center">
  <a href="https://github.com/norish-recipes/Norish/blob/main/LICENSE"><img src="https://img.shields.io/github/license/norish-recipes/Norish?style=for-the-badge" alt="License" /></a>
  <a href="https://github.com/norish-recipes/Norish/actions"><img src="https://img.shields.io/github/actions/workflow/status/norish-recipes/Norish/release-build.yml?style=for-the-badge&logo=github" alt="Build Status" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/pulls/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Pulls" /></a>
  <a href="https://hub.docker.com/r/norishapp/norish"><img src="https://img.shields.io/docker/image-size/norishapp/norish?style=for-the-badge&logo=docker" alt="Docker Image Size" /></a>
  <a href="https://buymeacoffee.com/mikevanes"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" /></a>
</p>

<p align="center"><a href="https://imgur.com/a/07VpBIc">Demo video</a></p>

---

# Vision

The vision for Norish is a shared recipe app, to be shared with friends to make one big recipe catalogue.

The name is derived of our dog named: Nora, and dish. As a coincidence this can also be pronounced as Nourish. If you look hard enough you can find a picture of Nora.

---

# Why

Norish was built solely because me and my girlfriend like to cook and keep track of our recipes. Sadly we could not get used to the aesthetic of Tandoor or Mealie. Both are great alternatives providing a more rich featureset than Norish. I have not tried tandoor or mealie enough to know their exact feature set but. I believe Noris is different in the sense that the instance is fully-realtime in theory.

This was one of the only requirements my girlfriend had as we do groceries together and this way we can keep track of who picked what grocery items.

Norish does not try to be Tandoor or Mealie it is minimalistic by nature, thus I am not sure yet if I will ever add complex cookbook structures, inventory tracking etc.

---

# Future

On my _todolist_ are still in order of current priority:

- Mobile apps.
- Public shareable recipe links.

---

## Features

- **Easy import** of recipes via URL, with a fallback to AI if configured.
- **Video recipe import** from YouTube Shorts, Instagram Reels, TikTok, and more _(requires OpenAI provider)_
- **Image recipe import** import a recipe from any set of images containing a recipe _(requires OpenAI provider)_
- **Nutritional information** Calculate nutritional information for a recipe _(requires OpenAI provider)_
- **Allergy warning** show allergy warnings for planned recipes. Can auto detect allergies based on ingredients. _(auto detection requires OpenAI provider)_
- **Unit conversion** Convert units from metric to US or vice versa, note: AI has to be enabled and setup for this.
- **Recurring groceries** Groceries can be marked as recurring this can be done using NLP or the interface
  - Currently we support: daily, weekly on day, monthly, montly on day. Every _x_ weeks on day.
- **Real-time sync** of recipes, grocery lists and meal plans
- **Households** Share grocery lists, and meal plan(calendar)
- **CalDav sync** Sync your recipes with any caldav provider(only tested with radicale)
- **Mobile-first design** for use in the kitchen
- **Light & dark mode** support
- **SSO (OIDC/OAuth2)** Norish supports login via OIDC/OAuth2. There are no plans to start supporting password login.
  - If no auth provider is configured email and password authentication will be enabled by default.
- **Admin Settings UI** for server owners to manage configuration without editing files
- **Permission policies** for controlling who can view/edit/delete recipes (everyone, household, or owner only)
  - Default view: Everyone
  - Defaul Edit: household
  - Default Remove: household
- **Local AI** In theory Norish supports local AI providers - however I have not tested this. Although I am looking to buy a machine that is capable.

_Note: All AI related features seem to be rather slow for me using the OpenAI API. I am not sure why this is your results may vary._

---

# Deploying

### Minimal Docker Compose

```yaml
services:
  norish:
    image: norishapp/norish:latest
    container_name: norish-app
    # user: "1000:1000"  # Match your host user's UID:GID (run `id` to check), only needed with bind mounts
    # The example uses named volume 'norish_data' which handles permissions automatically
    restart: always # Required for server restart functionality
    ports:
      - "3000:3000"
    volumes:
      - norish_data:/app/uploads
    environment:
      # Core settings (required)
      AUTH_URL: http://norish.example.com
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: <32-byte-base64-key> # Generate with: openssl rand -base64 32
      CHROME_WS_ENDPOINT: ws://chrome-headless:3000
      REDIS_URL: redis://redis:6379

      # OPTIONAL
      # NEXT_PUBLIC_LOG_LEVEL: info       # trace, debug, info, warn, error, fatal (default: info in prod, debug in dev)
      # TRUSTED_ORIGINS:http://192.168.1.100:3000,https://norish.example.com  # Additional trusted origins, comma separated. Useful when behind a proxy or using multiple domains.
      # YT_DLP_BIN_DIR: # Custom folder path for `yt-dlp` (default: /app/bin)

      # ─────────────────────────────────────────────────────────────────────────
      # FIRST USER SETUP
      # ─────────────────────────────────────────────────────────────────────────
      # On first startup, configure ONE auth provider below to create your admin account.
      # After first login, use Settings → Admin to configure additional providers,
      # AI settings, video parsing, and all other options.

      # Option 1= Password auth - basic auth with email/password
      # If not set defaults to disabled if OIDC or OAuth is configured.
      # Defaults to true if no other auth providers are configured.
      #PASSWORD_AUTH_ENABLED=false

      # Option 2: OIDC (Authentik, Keycloak, PocketID, etc.)
      # OIDC_NAME: NoraId
      # OIDC_ISSUER: https://nora.example.com
      # OIDC_CLIENT_ID: <client-id>
      # OIDC_CLIENT_SECRET: <client-secret>
      # OIDC_WELLKNOWN: https://auth.example.com/.well-known/openid-configuration
      # Wellknown is optional: By default the wellknown URL is derived from the issuer by appending /.well-known/openid-configuration

      # Option 3: GitHub OAuth (uncomment and remove OIDC above)
      # GITHUB_CLIENT_ID: <github-client-id>
      # GITHUB_CLIENT_SECRET: <github-client-secret>

      # Option 4: Google OAuth (uncomment and remove OIDC above)
      # GOOGLE_CLIENT_ID: <google-client-id>
      # GOOGLE_CLIENT_SECRET: <google-client-secret>
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

  # Chrome headless
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

  # Redis for real-time events and job queues
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

### First-User Setup

The **first user** to sign in becomes the **Server Owner** and **Server Admin** automatically. After the first user signs in:

- User registration is automatically disabled
- All server settings can be managed via **Settings => Admin** tab

---

## Admin Settings (Server Owner/Admin Only)

Server owners and admins can configure the following via the **Settings => Admin** tab:

### Registration

- Enable/disable new user registrations

### Permission Policies

- **View Recipes** - Who can see recipes (everyone, household members, or owner only)
- **Edit Recipes** - Who can modify recipes (everyone, household members, or owner only)
- **Delete Recipes** - Who can remove recipes (everyone, household members, or owner only)
- Server admins always have full access regardless of policy settings
- Groceries and calendar items follow household rules automatically (members can edit/delete each other's items)

### Authentication Providers

- **OIDC** (Authentik, Keycloak, PocketID, etc.)
- **GitHub OAuth**
- **Google OAuth**
- Test providers before saving, reveal/hide secrets, delete providers
- **Note:** Auth provider changes require a server restart to take effect (use the Restart Server button)

### Content Detection

- **Units** - Custom unit definitions for ingredient parsing
- **Content Indicators** - Schema and content indicators for recipe detection
- **Recurrence Config** - Locale-based recurrence patterns, used for natural language processing when adding recurring groceries.

### AI & Processing

- **AI Configuration** - Provider, endpoint, model, API key, temperature, max tokens
- **Video Processing** - Enable/disable, max video length, yt-dlp version
- **Transcription** - Provider, API key, model for video transcription

### System

- **Scheduler** - Configure cleanup retention period (months)
- **Restart Server** - Apply changes that require a server restart

---

## Environment Variables

Only a few environment variables are required. All other settings are managed via the **Admin UI**.

### Required Variables

| Variable             | Description                                    | Example                               |
| -------------------- | ---------------------------------------------- | ------------------------------------- |
| `AUTH_URL`           | Public URL of your Norish instance             | `https://norish.example.com`          |
| `DATABASE_URL`       | PostgreSQL connection string                   | `postgres://user:pass@db:5432/norish` |
| `MASTER_KEY`         | Master key for deriving encryption keys        | `openssl rand -base64 32`             |
| `CHROME_WS_ENDPOINT` | Puppeteer WebSocket endpoint for web scraping  | `ws://chrome-headless:3000`           |
| `REDIS_URL`          | Redis connection URL for events and job queues | `redis://redis:6379`                  |

### Optional Variables

| Variable                | Description                             | Default        |
| ----------------------- | --------------------------------------- | -------------- |
| `HOST`                  | Server bind address                     | `0.0.0.0`      |
| `PORT`                  | Server port                             | `3000`         |
| `RECIPES_DISK_DIR`      | Upload storage directory                | `/app/uploads` |
| `NEXT_PUBLIC_LOG_LEVEL` | Log level                               | `info`         |
| `TRUSTED_ORIGINS`       | Comma seperated list of trusted origins | `empty`        |
| `YT_DLP_BIN_DIR`        | Custom folder path for `yt-dlp`         | `/app/bin`     |

### First-Time Auth Provider

Configure **one** auth provider via environment variables to create your first admin account:

| Provider     | Variables                                                                                       | Callback                                                 |
| ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Password** | `PASSWORD_AUTH_ENABLED`                                                                         |                                                          |
| **OIDC**     | `OIDC_NAME`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_WELLKNOWN` (optional) | https://example.norish.com/api/auth/oauth2/callback/oidc |
| **GitHub**   | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`                                                      | https://example.norish.com/api/auth/callback/github      |
| **Google**   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                                      | https://example.norish.com/api/auth/callback/google      |

After first login, manage all auth providers via **Settings => Admin**.

---

## Local Development

```bash
# Clone the repository
git clone https://github.com/mikeve97/norish.git
cd norish

# Install dependencies
pnpm install

# Create your environment file
cp .env.example .env.local

# Spin up a postgres and redis instance (e.g. via docker)
# docker run -d --name norish-db -e POSTGRES_PASSWORD=norish -e POSTGRES_DB=norish -p 5432:5432 postgres:17-alpine
# docker run -d --name norish-redis -p 6379:6379 redis:7-alpine

# Run the app
pnpm run dev
```

### Development Commands

| Command                  | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `pnpm run dev`           | Start development server with hot reload                  |
| `pnpm run build`         | Full production build (Next.js + server + service worker) |
| `pnpm run test`          | Run tests in watch mode                                   |
| `pnpm run test:run`      | Run tests once                                            |
| `pnpm run test:coverage` | Run tests with coverage report                            |
| `pnpm run lint`          | Lint TypeScript files                                     |
| `pnpm run lint:fix`      | Lint and auto-fix issues                                  |
| `pnpm run format`        | Format all files with Prettier                            |
| `pnpm run format:check`  | Check formatting without making changes                   |

### Tooling Structure

All development tooling configuration is centralized in the `tooling/` folder:

```
tooling/
├── eslint/
│   └── eslint.config.mjs    # ESLint flat config with TypeScript, React, Prettier
├── tailwind/
│   ├── hero.ts              # HeroUI plugin export for Tailwind CSS v4
│   └── theme.css            # Custom theme colors (light/dark) using CSS variables
└── vitest/
    ├── vitest.config.ts     # Vitest configuration with React, jsdom
    └── setup.ts             # Test setup with jest-dom matchers
```

The root config files (`eslint.config.mjs`, `vitest.config.ts`) re-export from the tooling folder for tool compatibility.

---

## Tech Stack

### Frontend

- **Next.js 16**
- **Tailwind CSS 4**
- **HeroUI**
- **Framer Motion**
- **Zustand** – Not sure if I want to keep it, currently mostly unused in favor of the context API.
- **TanStack Query**

### Backend

- **Node.js** - Custom server that embeds the Next server for WS/Cron support.
- **tRPC**
- **Better Auth**
- **Pino**
- **BullMQ** - Job queue for background tasks (recipe import, AI processing, etc.)

### Database

- **PostgreSQL**
- **Drizzle ORM**
- **Redis** - Used for real-time pub/sub events and BullMQ job queues

### AI & Processing

- **OpenAI SDK**
- **Puppeteer** – Headless browser for web scraping (required).
- **yt-dlp** – Video downloading from YouTube, TikTok, etc.
- **Sharp** – To process the images to a uniform format.
- **FFmpeg**

### Testing

- **Vitest**
- **Testing Library**
- **jsdom**

### Tooling

- **TypeScript 5**
- **pnpm**
- **ESLint**
- **Prettier**

---

## License

Norish is licensed under [AGPL-3.0](LICENSE).

## Alternatives

Alternatives that I know of:
[Mealie](https://mealie.io/)
[Tandoor](https://tandoor.dev/)

---

# Note

_Current documentation is limited, I will start working on better documentation, a contribution guide etc._

---

# Nora

Last but not least a picture of our lovely dog Nora:

<img src="./public/nora.jpg" width="25%" alt="Grocery list" />
