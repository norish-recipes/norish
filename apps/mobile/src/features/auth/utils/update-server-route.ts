import type { Href } from "expo-router";

/**
 * Update your server for the server at `address`, which reported `version` when it said;
 * `animated: false` opens it with no stack animation (`instant`).
 */
export function updateServerHref(address: string, version?: string, animated = true): Href {
  return {
    pathname: "/update-server",
    params: { address, ...(version ? { version } : {}), ...(animated ? {} : { instant: "1" }) },
  };
}
