/**
 * The environment every process Norish starts gets: enough to run and reach the network
 * (through a proxy too), never Norish's own secrets such as MASTER_KEY or DATABASE_URL.
 */

const ALLOWED_NAMES = new Set([
  "PATH",
  "HOME",
  "LANG",
  "TZ",
  "TMPDIR",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]);

/** The allowlisted variables of this process, plus `extra`, which the caller names. */
export function childEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = { ...process.env };

  for (const name of Object.keys(env)) {
    if (!ALLOWED_NAMES.has(name) && !name.startsWith("LC_")) delete env[name];
  }

  return Object.assign(env, extra);
}
