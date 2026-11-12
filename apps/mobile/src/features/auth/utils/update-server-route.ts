import type { Href } from "expo-router";

/** Update your server for the server at `address`, which reported `version` when it said. */
export function updateServerHref(address: string, version?: string): Href {
  return { pathname: "/update-server", params: version ? { address, version } : { address } };
}
