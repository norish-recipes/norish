/** What the measurement scripts share: their account flags and a signed-in phone. */
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
