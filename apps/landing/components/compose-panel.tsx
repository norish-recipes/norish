"use client";

import { useState, useSyncExternalStore } from "react";
import { ArrowPathIcon, CheckIcon, ClipboardIcon } from "@heroicons/react/24/outline";

import { button } from "./button";

type Secrets = { masterKey: string; obscuraToken: string };

const placeholders: Secrets = {
  masterKey: "<openssl rand -base64 32>",
  obscuraToken: "<openssl rand -hex 32>",
};

function randomBytes(count: number) {
  return crypto.getRandomValues(new Uint8Array(count));
}

function generate(): Secrets {
  return {
    // Matches `openssl rand -base64 32`.
    masterKey: btoa(String.fromCharCode(...randomBytes(32))),
    // Matches `openssl rand -hex 32`.
    obscuraToken: Array.from(randomBytes(32), (byte) => byte.toString(16).padStart(2, "0")).join(
      ""
    ),
  };
}

// Made in the browser only: the static export and the hydrating render show the
// placeholders, so no secret ever reaches the markup.
let secrets: Secrets | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function regenerate() {
  secrets = generate();
  for (const listener of listeners) listener();
}

function compose({ masterKey, obscuraToken }: Secrets) {
  return `services:
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
      MASTER_KEY: ${masterKey}
      OBSCURA_ENDPOINT: ws://obscura:9222
      OBSCURA_CDP_TOKEN: ${obscuraToken}
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
      OBSCURA_CDP_TOKEN: ${obscuraToken}

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
`;
}

/** The README's compose file with fresh secrets, ready to copy and run. */
export function ComposePanel() {
  const current = useSyncExternalStore(
    subscribe,
    () => (secrets ??= generate()),
    () => placeholders
  );
  const [copied, setCopied] = useState(false);
  const file = compose(current);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard outside a secure context; the file can still be selected.
    }
  };

  return (
    <div className="bg-bezel text-bezel-foreground flex min-w-0 flex-[1.6] basis-[32rem] flex-col overflow-hidden rounded-3xl">
      <div className="border-accent-deep flex flex-wrap items-center justify-between gap-3 border-b py-3.5 pr-3.5 pl-6">
        <span className="font-mono text-[0.9375rem]">docker-compose.yaml</span>
        <div className="flex gap-2">
          <button
            className={`${button.onAccentQuiet} min-h-11 px-4 text-[0.9375rem]`}
            type="button"
            onClick={regenerate}
          >
            <ArrowPathIcon />
            New secrets
          </button>
          <button
            className={`${button.onAccent} min-h-11 px-4.5 text-[0.9375rem]`}
            type="button"
            onClick={copy}
          >
            {copied ? <CheckIcon /> : <ClipboardIcon />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="max-h-110 overflow-auto px-6 py-5 font-mono text-sm leading-relaxed">
        <code>{file}</code>
      </pre>
      <p className="border-accent-deep border-t px-6 pt-3.5 pb-4.5 text-[0.9375rem] opacity-85">
        The secrets are made in your browser. Save it, run{" "}
        <code className="font-mono">docker compose up -d</code>, and keep the keys stable.
      </p>
    </div>
  );
}
