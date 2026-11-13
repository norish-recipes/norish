import { use } from "react";
import { ServerAddressContext } from "@/lib/network/server-address";

/** A server-relative path (an uploaded image) as an absolute URL on the Server Address. */
export function serverUrl(address: string | null, path: string): string {
  if (/^https?:\/\//.test(path) || address === null) return path;

  return `${address}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** `serverUrl` on the Server Address the app is rendered with. */
export function useServerUrl() {
  const address = use(ServerAddressContext);

  return (path: string) => serverUrl(address, path);
}
