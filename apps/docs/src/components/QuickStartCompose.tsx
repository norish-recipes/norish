import React, { useEffect, useState } from "react";
import CodeBlock from "@theme/CodeBlock";

// Server-rendered placeholders. The real secrets are generated in the browser
// on mount, so every page visit gets a unique MASTER_KEY and Obscura token
// without ever sending one over the network.
const PLACEHOLDER = "REPLACE_WITH_A_RANDOM_KEY";
const TOKEN_PLACEHOLDER = "REPLACE_WITH_A_RANDOM_TOKEN";

function randomBytes(): Uint8Array | null {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return null;
  }
  return crypto.getRandomValues(new Uint8Array(32));
}

function randomKey(): string {
  const bytes = randomBytes();
  if (!bytes) return PLACEHOLDER;
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Matches `openssl rand -hex 32`. */
function randomToken(): string {
  const bytes = randomBytes();
  if (!bytes) return TOKEN_PLACEHOLDER;
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function composeFile(masterKey: string, obscuraToken: string): string {
  return `services:
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
      MASTER_KEY: ${masterKey}
      OBSCURA_ENDPOINT: ws://obscura:9222
      OBSCURA_CDP_TOKEN: ${obscuraToken}
      VALKEY_URL: valkey://valkey:6379
      UPLOADS_DIR: /app/uploads
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
  valkey_data:`;
}

export default function QuickStartCompose() {
  // Start from the placeholders so server and first client render match, then
  // swap in freshly generated secrets after mount.
  const [masterKey, setMasterKey] = useState(PLACEHOLDER);
  const [obscuraToken, setObscuraToken] = useState(TOKEN_PLACEHOLDER);

  useEffect(() => {
    setMasterKey(randomKey());
    setObscuraToken(randomToken());
  }, []);

  return (
    <CodeBlock language="yaml" title="docker-compose.yml">
      {composeFile(masterKey, obscuraToken)}
    </CodeBlock>
  );
}
