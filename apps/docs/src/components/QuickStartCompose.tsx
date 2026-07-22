import React, { useEffect, useState } from "react";
import CodeBlock from "@theme/CodeBlock";

// Server-rendered placeholder. The real key is generated in the browser on
// mount (and again on demand), so every page visit gets a unique MASTER_KEY
// without ever sending one over the network.
const PLACEHOLDER = "REPLACE_WITH_A_RANDOM_KEY";

function randomKey(): string {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return PLACEHOLDER;
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function composeFile(masterKey: string): string {
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
      CHROME_WS_ENDPOINT: ws://chrome-headless:3000
      REDIS_URL: redis://redis:6379
      UPLOADS_DIR: /app/uploads
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
  redis_data:`;
}

export default function QuickStartCompose() {
  // Start from the placeholder so server and first client render match, then
  // swap in a freshly generated key after mount.
  const [masterKey, setMasterKey] = useState(PLACEHOLDER);

  useEffect(() => {
    setMasterKey(randomKey());
  }, []);

  return (
    <CodeBlock language="yaml" title="docker-compose.yml">
      {composeFile(masterKey)}
    </CodeBlock>
  );
}
