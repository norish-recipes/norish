/** The URL prefix the web app is built for (NEXT_PUBLIC_BASE_PATH), empty at the domain root. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The app's root URL: the bare prefix (Next serves `/norish`, not `/norish/`), or `/`. */
export const APP_ROOT = BASE_PATH || "/";

/** Prefix a root-relative path once; absolute, protocol-relative, data and blob URLs pass through. */
export function addBasePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") ? `${BASE_PATH}${path}` : path;
}

/** Remove the prefix from a path the browser reports, leaving a root-relative path. */
export function stripBasePath(path: string): string {
  if (!BASE_PATH) return path;
  if (path === BASE_PATH) return "/";

  return path.startsWith(`${BASE_PATH}/`) ? path.slice(BASE_PATH.length) : path;
}
