import React, { useEffect, useState } from "react";
import CodeBlock from "@theme/CodeBlock";

// Server-rendered placeholder. The real token is generated in the browser on
// mount, so every page visit gets a unique Obscura token without ever sending
// one over the network.
const TOKEN_PLACEHOLDER = "REPLACE_WITH_A_RANDOM_TOKEN";

/** Matches `openssl rand -hex 32`. */
function randomToken(): string {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return TOKEN_PLACEHOLDER;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function composeFile(obscuraToken: string): string {
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
    image: norishapp/obscura:0.2.7-norish.1
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
  // Start from the placeholder so server and first client render match, then
  // swap in a freshly generated token after mount.
  const [obscuraToken, setObscuraToken] = useState(TOKEN_PLACEHOLDER);

  useEffect(() => {
    setObscuraToken(randomToken());
  }, []);

  return (
    <CodeBlock language="yaml" title="docker-compose.yml">
      {composeFile(obscuraToken)}
    </CodeBlock>
  );
}
