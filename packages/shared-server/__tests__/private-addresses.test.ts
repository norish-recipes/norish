// @vitest-environment node
/**
 * `guardedFetch` refuses a private address on the socket it dials, against a real local server: a
 * literal, and a name whose connect-time answer is private though the pre-check saw a public one.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { guardedFetch, isRefusedHost } from "@norish/shared-server/private-addresses";

/** The pre-check's answer (dns/promises) and the connect-time answer (dns) for each name. */
const { checked, dialled } = vi.hoisted(() => ({
  checked: { "rebind.test": "93.184.215.14" } as Record<string, string>,
  dialled: { "rebind.test": "127.0.0.1", "public.test": "192.0.2.1" } as Record<string, string>,
}));

vi.mock("node:dns/promises", () => ({
  lookup: async (host: string) => [{ address: checked[host] ?? host, family: 4 }],
}));
vi.mock("node:dns", async (original) => ({
  ...(await original<typeof import("node:dns")>()),
  lookup: vi.fn(
    (
      host: string,
      options: { all?: boolean },
      callback: (err: Error | null, ...rest: unknown[]) => void
    ) => {
      const address = dialled[host] ?? host;

      if (options.all) callback(null, [{ address, family: 4 }]);
      else callback(null, address, 4);
    }
  ),
}));

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((_request, response) => response.end("internal"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

/** The reason a fetch failed, as its cause names it. */
async function failure(url: string): Promise<string> {
  const error = await guardedFetch(url, { signal: AbortSignal.timeout(1_000) }, false).then(
    () => "answered",
    (err: Error) => String((err.cause as Error | undefined)?.message ?? err.message)
  );

  return error;
}

describe("guardedFetch", () => {
  it("refuses a private address written into the URL", async () => {
    await expect(fetch(`http://127.0.0.1:${port}/`).then((r) => r.text())).resolves.toBe(
      "internal"
    );
    expect(await failure(`http://127.0.0.1:${port}/`)).toMatch(/private address/);
  });

  it("refuses a name that resolves to a private address when it connects (DNS rebinding)", async () => {
    await expect(isRefusedHost("rebind.test", false)).resolves.toBe(false);
    expect(await failure(`http://rebind.test:${port}/`)).toMatch(/private address/);
  });

  it("dials a name that resolves to a public address", async () => {
    const { lookup } = await import("node:dns");

    expect(await failure(`http://public.test:${port}/`)).not.toMatch(/private address/);
    expect(lookup).toHaveBeenCalledWith("public.test", expect.anything(), expect.any(Function));
  });
});
