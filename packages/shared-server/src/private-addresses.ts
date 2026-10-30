/**
 * Private addresses (ADR-0019): what a page fetch refuses unless an administrator allows them.
 */
import { lookup as lookupEach } from "node:dns";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import { Agent, buildConnector } from "undici";

/**
 * Loopback, RFC1918, CGNAT (Tailscale), benchmarking, link-local, multicast, reserved, unique-local,
 * NAT64, 6to4, Teredo, IPv4-compatible and unspecified; IPv4-mapped IPv6 matches too.
 */
const PRIVATE_ADDRESSES = new BlockList();

/* eslint-disable sonarjs/no-hardcoded-ip -- the private ranges are what is refused */
PRIVATE_ADDRESSES.addSubnet("0.0.0.0", 8, "ipv4");
PRIVATE_ADDRESSES.addSubnet("127.0.0.0", 8, "ipv4");
PRIVATE_ADDRESSES.addSubnet("10.0.0.0", 8, "ipv4");
PRIVATE_ADDRESSES.addSubnet("172.16.0.0", 12, "ipv4");
PRIVATE_ADDRESSES.addSubnet("192.168.0.0", 16, "ipv4");
PRIVATE_ADDRESSES.addSubnet("169.254.0.0", 16, "ipv4");
PRIVATE_ADDRESSES.addSubnet("100.64.0.0", 10, "ipv4");
PRIVATE_ADDRESSES.addSubnet("198.18.0.0", 15, "ipv4");
PRIVATE_ADDRESSES.addSubnet("224.0.0.0", 4, "ipv4");
PRIVATE_ADDRESSES.addSubnet("240.0.0.0", 4, "ipv4");
PRIVATE_ADDRESSES.addSubnet("::", 96, "ipv6");
PRIVATE_ADDRESSES.addSubnet("fc00::", 7, "ipv6");
PRIVATE_ADDRESSES.addSubnet("fe80::", 10, "ipv6");
PRIVATE_ADDRESSES.addSubnet("64:ff9b::", 96, "ipv6");
PRIVATE_ADDRESSES.addSubnet("2002::", 16, "ipv6");
PRIVATE_ADDRESSES.addSubnet("2001::", 32, "ipv6");
/* eslint-enable sonarjs/no-hardcoded-ip */

/** Every address a host resolves to; an address, bracketed or not, resolves to itself. */
export function addressesOf(hostname: string): Promise<LookupAddress[]> {
  return lookup(hostname.replace(/^\[|\]$/g, ""), { all: true });
}

export function isPrivate({ address, family }: LookupAddress): boolean {
  return PRIVATE_ADDRESSES.check(address, family === 6 ? "ipv6" : "ipv4");
}

/**
 * Whether a host is refused before anything is sent: it is, or resolves to, a private address the
 * administrator does not allow. `publicOnly` repeats the check on the address actually dialled.
 */
export async function isRefusedHost(
  hostname: string,
  allowPrivateAddresses: boolean
): Promise<boolean> {
  if (allowPrivateAddresses) return false;

  // A name that does not resolve is left to the fetch to fail.
  return (await addressesOf(hostname).catch(() => [])).some(isPrivate);
}

const refusal = (host: string) => new Error(`Refused to connect to a private address (${host})`);

const connect = buildConnector({
  lookup: (hostname, options, callback) =>
    lookupEach(hostname, options, (err, address, family) => {
      const found = typeof address === "string" ? [{ address, family }] : address;

      callback(!err && found.some(isPrivate) ? refusal(hostname) : err, address, family);
    }),
});

/**
 * Refuses private addresses as each socket connects, so a name that resolves differently the
 * second time (DNS rebinding) or a redirect cannot reach one.
 */
const publicOnly = new Agent({
  connect: (options, callback) => {
    const family = isIP(options.hostname);

    if (family && isPrivate({ address: options.hostname, family })) {
      callback(refusal(options.hostname), null);

      return;
    }

    connect(options, callback);
  },
});

/**
 * `fetch` that refuses private addresses unless the administrator allows them. The DOM lib's
 * RequestInit leaves out the `dispatcher` Node's fetch takes, hence the cast.
 */
export function guardedFetch(
  url: string,
  init: RequestInit,
  allowPrivateAddresses: boolean
): Promise<Response> {
  return fetch(
    url,
    allowPrivateAddresses ? init : ({ ...init, dispatcher: publicOnly } as RequestInit)
  );
}
