import { AUTH_COOKIE_KEY, authStorage } from "@/lib/auth/auth-storage";
import { getServerAddress } from "@/lib/network/server-address";
import { getCookie } from "@better-auth/expo/client";

// The auth client's getCookie is async and callers ask for headers synchronously, so read the
// chunked SecureStore entry the auth client writes directly.
export function authHeaders(): Record<string, string> {
  if (!getServerAddress()) {
    return {};
  }

  const cookies = getCookie(authStorage().getItem(AUTH_COOKIE_KEY));

  return cookies ? { Cookie: cookies } : {};
}
