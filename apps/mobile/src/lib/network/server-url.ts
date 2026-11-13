/** A server-relative path (an uploaded image) as an absolute URL on the Server Address. */
export function serverUrl(address: string | null, path: string): string {
  if (/^https?:\/\//.test(path) || address === null) return path;

  return `${address}${path.startsWith("/") ? "" : "/"}${path}`;
}
