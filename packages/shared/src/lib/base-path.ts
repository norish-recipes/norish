/**
 * The URL prefix the web app is served under, or an empty string at the root.
 *
 * Next.js inlines NEXT_PUBLIC_BASE_PATH into the client bundle at build time
 * and the server reads the same value at runtime, so one image serves one
 * prefix (ADR-0040). Every absolute URL the app emits goes through
 * `addBasePath`; `next/link` and `next/router` apply the prefix themselves, so
 * their values stay bare.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * The app's root URL: the bare prefix at an instance, `/` at the domain root.
 * Next.js serves a base-path app at `/norish`, not `/norish/`, and redirects
 * the trailing-slash form, so links and scopes use this value.
 */
export const APP_ROOT = BASE_PATH || "/";

/**
 * Prefix an absolute path once. A path that already carries the prefix is
 * returned unchanged, so a caller cannot double it by passing a request URL
 * that Next.js already prefixed.
 */
export function prefixPath(basePath: string, path: string): string {
  if (!basePath || !path.startsWith("/")) return path;
  if (path === basePath || path.startsWith(`${basePath}/`)) return path;

  return `${basePath}${path}`;
}

/** Remove the instance prefix from a request path, leaving a root-relative path. */
export function stripBasePath(path: string): string {
  if (!BASE_PATH) return path;
  if (path === BASE_PATH) return "/";
  if (path.startsWith(`${BASE_PATH}/`)) return path.slice(BASE_PATH.length);

  return path;
}

export function addBasePath(path: string): string {
  return prefixPath(BASE_PATH, path);
}

/**
 * Prefix a URL the browser fetches or renders. Absolute URLs, data and blob
 * URLs are left alone; root-relative paths get the prefix.
 */
export function addBasePathToUrl(url: string): string {
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("//")
  ) {
    return url;
  }

  return addBasePath(url);
}
