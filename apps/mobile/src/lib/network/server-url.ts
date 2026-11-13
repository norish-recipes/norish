import { use } from "react";
import { authHeaders } from "@/lib/auth/auth-headers";
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

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** An image as an `Image` source; the session cookie goes only to the Server Address's origin. */
export function serverImage(address: string | null, path: string) {
  const uri = serverUrl(address, path);
  const onServer =
    address !== null && originOf(uri) !== null && originOf(uri) === originOf(address);

  return onServer ? { uri, headers: authHeaders() } : { uri };
}

/** `serverImage` on the Server Address the app is rendered with. */
export function useServerImage() {
  const address = use(ServerAddressContext);

  return (path: string) => serverImage(address, path);
}
