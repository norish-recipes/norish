import { readStoredCookie } from "@/lib/auth/auth-storage";
import { getServerAddress } from "@/lib/network/server-address";
import { getCookie } from "@better-auth/expo/client";

// The auth client's getCookie is async and callers ask for headers synchronously, so read the
// stored cookie the auth client writes, kept in memory until its next write.
export function authHeaders(): Record<string, string> {
  if (!getServerAddress()) {
    return {};
  }

  const cookies = getCookie(readStoredCookie());

  return cookies ? { Cookie: cookies } : {};
}
