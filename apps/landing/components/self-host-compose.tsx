"use client";

import { useSyncExternalStore } from "react";
import { links } from "@/lib/css-tokens";
import { LockClosedIcon } from "@heroicons/react/24/outline";

import { CopyCommand } from "./copy-command";

const TOKEN_PLACEHOLDER = "<openssl rand -hex 32>";

function buildCompose(obscuraToken: string) {
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
      VALKEY_URL: valkey://valkey:6379
      OBSCURA_ENDPOINT: ws://obscura:9222
      OBSCURA_CDP_TOKEN: ${obscuraToken}
    depends_on: [db, valkey, obscura]

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_PASSWORD: norish
      POSTGRES_DB: norish
    volumes:
      - db_data:/var/lib/postgresql/data

  valkey:
    image: valkey/valkey:9
    volumes:
      - valkey_data:/data

  # Renders recipe pages for URL imports
  obscura:
    image: norishapp/obscura:0.2.7-norish.1
    environment:
      OBSCURA_CDP_TOKEN: ${obscuraToken}

volumes:
  db_data:
  norish_data:
  valkey_data:`;
}

/** Generate a 32-byte random token, hex-encoded — matches `openssl rand -hex 32`. */
function generateObscuraToken() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Renders the docker-compose snippet with an Obscura token generated locally in the browser,
 * so the copied file is unique and ready to run with no extra steps.
 */
let generated: string | undefined;
const noSubscription = () => () => {};

export function SelfHostCompose() {
  // Generated in the browser only, once per page load: the server and the
  // hydrating render show the placeholder, so the token never reaches markup.
  const obscuraToken = useSyncExternalStore(
    noSubscription,
    () => (generated ??= generateObscuraToken()),
    () => TOKEN_PLACEHOLDER
  );

  const ready = obscuraToken !== TOKEN_PLACEHOLDER;

  return (
    <div className="reveal min-w-0 flex-[1.6] basis-[32rem] [--delay:150ms]">
      <CopyCommand collapsible code={buildCompose(obscuraToken)} />
      <p className="text-accent-foreground/85 mt-3 flex items-start gap-1.5 text-xs text-pretty">
        <LockClosedIcon className="mt-0.5 size-3.5 shrink-0" />
        {ready ? (
          <span>
            A unique Obscura token was generated right here in your browser. No data is saved.{" "}
            <a
              className="hover:text-accent-foreground underline underline-offset-2 transition-colors"
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
    </div>
  );
}
