// Hosts the dev server accepts dev-only requests (HMR, dev chunks) from: the
// defaults plus the comma-separated `extra` (ALLOWED_DEV_ORIGINS), so a developer
// behind a proxy or on another hostname need not edit next.config.js.
export function withExtraDevOrigins(defaults, extra) {
  const hosts = (extra ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([...defaults, ...hosts]));
}
