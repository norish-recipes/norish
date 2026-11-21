import { withoutTrailingSlashes } from "@norish/shared/lib/helpers";

/** The server listens for the tRPC socket at `<base path>/trpc`. */
export function getBackendWsUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);

  parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  parsed.pathname = `${withoutTrailingSlashes(parsed.pathname)}/trpc`;
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString();
}
