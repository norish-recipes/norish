"use client";

import { useEffect, useState } from "react";
import { links } from "@/lib/css-tokens";
import { LockClosedIcon } from "@heroicons/react/24/outline";

import { CopyCommand } from "../copy-command";
import { Reveal } from "../reveal";

const PLACEHOLDER = "<openssl rand -base64 32>";

function buildCompose(masterKey: string) {
  return `services:
  norish:
    image: norishapp/norish:latest
    restart: always
    ports: ["3000:3000"]
    volumes:
      - norish_data:/app/uploads
    environment:
      AUTH_URL: http://localhost:3000
      DATABASE_URL: postgres://postgres:norish@db:5432/norish
      MASTER_KEY: ${masterKey}
      REDIS_URL: redis://redis:6379
      OBSCURA_ENDPOINT: ws://obscura:9222
    depends_on: [db, redis, obscura]

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

  # Renders recipe pages for URL imports
  obscura:
    image: norishapp/obscura:0.2.2-norish.1

volumes:
  db_data:
  norish_data:
  redis_data:`;
}

/** Generate a 32-byte random key, base64-encoded — matches `openssl rand -base64 32`. */
function generateMasterKey() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  let binary = "";

  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary);
}

/**
 * Renders the docker-compose snippet with a MASTER_KEY generated locally in the
 * browser, so the copied file is unique and ready to run with no extra steps.
 */
export function SelfHostCompose() {
  const [masterKey, setMasterKey] = useState(PLACEHOLDER);

  // Generated after mount to keep SSR markup stable and the secret client-only.
  useEffect(() => setMasterKey(generateMasterKey()), []);

  const ready = masterKey !== PLACEHOLDER;

  return (
    <Reveal className="min-w-0" delay={120}>
      <CopyCommand collapsible code={buildCompose(masterKey)} />
      <p className="text-muted mt-3 flex items-start gap-1.5 text-xs text-pretty">
        <LockClosedIcon className="text-accent mt-0.5 size-3.5 shrink-0" />
        {ready ? (
          <span>
            A unique <span className="text-foreground font-mono">MASTER_KEY</span> was generated
            right here in your browser. No data is saved.{" "}
            <a
              className="hover:text-foreground underline underline-offset-2 transition-colors"
              href={links.keyGen}
              rel="noreferrer"
              target="_blank"
            >
              View the code
            </a>
            .
          </span>
        ) : (
          <span>Generating a unique secret key in your browser…</span>
        )}
      </p>
    </Reveal>
  );
}
