/** What the measurement scripts share: their flags, a signed-in phone, and the API. */
import type { Browser, BrowserContext, BrowserContextOptions } from "@playwright/test";
import { devices } from "@playwright/test";

export const PHONE = devices["Pixel 7"];

/** The flags naming the instance and account a script signs in to, for `parseArgs`. */
export function accountOptions(base: string) {
  return {
    base: { type: "string", default: base },
    email: { type: "string" },
    password: { type: "string" },
  } as const;
}

/** The account the flags name; `--email` and `--password` must be given. */
export function account(flags: { base: string; email?: string; password?: string }) {
  const { base, email, password } = flags;

  if (!email || !password) throw new Error("--email and --password are required");

  return { base, email, password };
}

/** A Pixel 7 at `baseURL`, signed in with `cookies`. */
export async function newPhone(
  browser: Browser,
  baseURL: string,
  cookies: Parameters<BrowserContext["addCookies"]>[0],
  options: BrowserContextOptions = {}
) {
  const context = await browser.newContext({ ...PHONE, baseURL, ...options });

  await context.addCookies(cookies);
  // tsx builds with esbuild's keepNames, which wraps functions in a `__name(fn, "name")` call;
  // the functions sent to the page still make it, so the page gets a `__name` that does nothing.
  await context.addInitScript({ content: "globalThis.__name = (target) => target;" });

  return context;
}

/** Signs in with a password; answers the session's cookies. */
export async function signIn(base: string, email: string, password: string) {
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) throw new Error(`Sign-in failed: ${response.status}`);

  return response.headers.getSetCookie().map((header) => {
    const [pair = ""] = header.split(";");
    const at = pair.indexOf("=");

    return { name: pair.slice(0, at), value: pair.slice(at + 1) };
  });
}

/** A tRPC query, or with `mutation` a mutation, as the session in `cookie`. */
export async function callTrpc<T>(
  base: string,
  cookie: string,
  procedure: string,
  input?: unknown,
  mutation = false
): Promise<T> {
  const envelope = JSON.stringify({ json: input });
  const response = await fetch(
    `${base}/api/trpc/${procedure}${mutation || input === undefined ? "" : `?input=${encodeURIComponent(envelope)}`}`,
    mutation
      ? { method: "POST", headers: { cookie, "content-type": "application/json" }, body: envelope }
      : { headers: { cookie } }
  );

  if (!response.ok) throw new Error(`${procedure} failed: ${response.status}`);

  return ((await response.json()) as { result: { data: { json: T } } }).result.data.json;
}
