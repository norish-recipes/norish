import { ArrowTopRightOnSquareIcon, ScaleIcon, ServerStackIcon } from "@heroicons/react/24/outline";

import { CopyCommand } from "../copy-command";
import { CTAButton } from "../cta-button";
import { DockerIcon, GitHubIcon } from "../icons";
import { Reveal } from "../motion/reveal";

import { links } from "@/lib/css-tokens";

const compose = `services:
  norish:
    image: norishapp/norish:latest
    restart: always
    ports: ["3000:3000"]
    volumes:
      - norish_data:/app/uploads
    environment:
      AUTH_URL: http://localhost:3000
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: <openssl rand -base64 32>
      REDIS_URL: redis://redis:6379
      CHROME_WS_ENDPOINT: ws://chrome-headless:3000
    depends_on: [db, redis, chrome-headless]

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: norish
      POSTGRES_DB: norish
    volumes:
      - db_data:/var/lib/postgresql/data

  redis:
    image: redis:8.6.2
    volumes:
      - redis_data:/data

  # Headless Chrome, used to scrape recipes from the web
  chrome-headless:
    image: zenika/alpine-chrome:latest
    command:
      - --no-sandbox
      - --remote-debugging-address=0.0.0.0
      - --remote-debugging-port=3000
      - --headless
    shm_size: 256m

volumes:
  db_data:
  norish_data:
  redis_data:`;

const badges = [
  { icon: ScaleIcon, label: "AGPL-3.0 licensed" },
  { icon: ServerStackIcon, label: "Self-hosted" },
  { icon: DockerIcon, label: "One-command Docker" },
];

export function SelfHost() {
  return (
    <section className="scroll-mt-24 px-4 py-20 sm:py-28" id="self-host">
      <div className="mx-auto max-w-6xl">
        <div className="border-border bg-surface relative overflow-hidden rounded-3xl border p-6 sm:p-10 lg:p-14">
          {/* soft accent glow */}
          <div
            aria-hidden
            className="bg-accent/10 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-[120px]"
          />

          <div className="grid items-start gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-accent text-sm font-semibold tracking-wide uppercase">
                Open source &amp; self-hosted
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Your recipes. Your server. Your rules.
              </h2>
              <p className="text-muted mt-4 text-pretty">
                Norish is free and fully open source under the AGPL-3.0 license. Run it on your own
                hardware with Docker, with no subscriptions and no lock-in. Bring your own auth with
                OIDC, GitHub or Google, or keep it simple with email and password.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {badges.map(({ icon: Icon, label }) => (
                  <span
                    key={label}
                    className="border-border bg-surface-secondary/40 text-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                  >
                    <Icon className="text-accent size-3.5" />
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <CTAButton external className="w-full sm:w-auto" href={links.github} size="lg">
                  <GitHubIcon className="size-4.5" />
                  View on GitHub
                </CTAButton>
                <CTAButton
                  external
                  className="w-full sm:w-auto"
                  href={links.selfHost}
                  size="lg"
                  variant="secondary"
                >
                  Read the docs
                  <ArrowTopRightOnSquareIcon className="size-4" />
                </CTAButton>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <CopyCommand collapsible code={compose} />
              <p className="text-muted mt-3 text-center font-mono text-xs">
                then <span className="text-foreground">docker compose up -d</span>, and you&apos;re
                cooking.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
