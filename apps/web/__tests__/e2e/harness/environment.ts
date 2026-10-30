/** The key every stack's server encrypts with, so a worker's repositories read what it wrote. */
export const MASTER_KEY = "X4fjLgB8egCPwlOQW8iC3JGXAtUIMUOGmk/y29n+YSw=";

/** Where repositories point outside a stack's life, so a stray call fails instead of reaching a real database. */
export const UNCONNECTED_DATABASE_URL =
  "postgresql://unconnected:unconnected@127.0.0.1:1/unconnected";

/** The same for Valkey, which the server config requires. */
const UNCONNECTED_VALKEY_URL = "valkey://127.0.0.1:1";

/** What `@norish/config` parses when a worker first imports a repository. */
export function prepareRepositoryEnvironment(): void {
  Object.assign(process.env, {
    NODE_ENV: "production",
    MASTER_KEY,
    DATABASE_URL: UNCONNECTED_DATABASE_URL,
    VALKEY_URL: UNCONNECTED_VALKEY_URL,
  });
}
