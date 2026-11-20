/**
 * A CalDAV server whose certificate nothing public vouches for, such as one
 * signed by a home certificate authority (#703): the user may trust it for that
 * connection only, after seeing which certificate it is.
 */
import { X509Certificate } from "node:crypto";
import { isIP } from "node:net";
import tls from "node:tls";
import type { RequestInfo as UndiciRequestInfo, RequestInit as UndiciRequestInit } from "undici";
import { Agent, fetch as undiciFetch } from "undici";

import type { UntrustedCertificate } from "@norish/shared/contracts/dto/caldav";

/** Refusals that trusting the server's certificate cures; a wrong host or an expired one is not. */
const UNTRUSTED_CHAIN = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

export function isUntrustedChain(error: unknown): boolean {
  const cause = error instanceof Error ? error.cause : undefined;

  return cause instanceof Error && "code" in cause && UNTRUSTED_CHAIN.has(String(cause.code));
}

export function isCertificate(pem: string): boolean {
  try {
    return new X509Certificate(pem).toString().length > 0;
  } catch {
    return false;
  }
}

// ponytail: one agent per trusted certificate, never evicted; bounded by users x renewals.
const agents = new Map<string, Agent>();

/**
 * `fetch` that trusts `pem` besides the usual authorities (NODE_EXTRA_CA_CERTS included).
 * The agent comes from the same undici as the fetch, which is what a dispatcher needs.
 */
export function fetchTrusting(pem: string): typeof fetch {
  let dispatcher = agents.get(pem);

  if (!dispatcher) {
    // Partial chains let a server's own certificate, not only a root, be the anchor.
    dispatcher = new Agent({
      connect: { ca: [...tls.getCACertificates("default"), pem], allowPartialTrustChain: true },
    });
    agents.set(pem, dispatcher);
  }

  const trusting = dispatcher;

  return (url, init) =>
    undiciFetch(url as UndiciRequestInfo, {
      ...(init as UndiciRequestInit),
      dispatcher: trusting,
    }) as unknown as Promise<Response>;
}

/**
 * The top certificate of the chain `serverUrl` presents, read over TLS without sending
 * anything. Null when trusting it would not help: another host's certificate, or expired.
 */
export function readServerCertificate(serverUrl: string): Promise<UntrustedCertificate | null> {
  const url = new URL(serverUrl);
  const host = url.hostname.replace(/^\[|\]$/g, "");

  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port: Number(url.port) || 443,
      servername: isIP(host) ? undefined : host,
      // Only to read the certificate: nothing is written to this socket.
      rejectUnauthorized: false,
    });

    socket.setTimeout(10_000, () => socket.destroy());
    socket.once("error", () => resolve(null));
    socket.once("close", () => resolve(null));
    socket.once("secureConnect", () => {
      const leaf = socket.getPeerCertificate(true);

      socket.end();

      if (!leaf.raw || tls.checkServerIdentity(host, leaf)) return resolve(null);

      let top = leaf;

      while (
        top.issuerCertificate?.raw &&
        top.issuerCertificate.fingerprint256 !== top.fingerprint256
      ) {
        top = top.issuerCertificate;
      }

      const certificate = new X509Certificate(top.raw);

      if (certificate.validToDate < new Date()) return resolve(null);

      resolve({
        pem: certificate.toString(),
        name: String(top.subject.CN || top.subject.O || host),
        fingerprint: certificate.fingerprint256,
      });
    });
  });
}
