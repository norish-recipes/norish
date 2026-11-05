/**
 * Trusting a CalDAV server's own certificate (#703), against real TLS servers whose
 * certificates openssl makes for the run: no private key is committed.
 */

// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  fetchTrusting,
  isCertificate,
  isUntrustedChain,
  readServerCertificate,
} from "../../src/caldav/trusted-certificate";

const hasOpenssl = (() => {
  try {
    execFileSync("openssl", ["version"]);

    return true;
  } catch {
    return false;
  }
})();

const dir = mkdtempSync(join(tmpdir(), "caldav-cert-"));
const file = (name: string) => join(dir, name);
const read = (name: string) => readFileSync(file(name), "utf8");

function openssl(...args: string[]) {
  execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
}

function serve(key: string, cert: string): Promise<{ url: string; close: () => void }> {
  const server = https.createServer({ key, cert }, (_req, res) => res.end("ok"));

  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;

      resolve({ url: `https://localhost:${port}/`, close: () => server.close() });
    })
  );
}

async function refusal(url: string) {
  return fetch(url).then(
    () => null,
    (error: unknown) => error
  );
}

describe.skipIf(!hasOpenssl)("trusted certificate", () => {
  let selfSigned: Awaited<ReturnType<typeof serve>>;
  let homeCa: Awaited<ReturnType<typeof serve>>;

  beforeAll(async () => {
    const subject = ["-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"];

    openssl(
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "2",
      ...subject,
      "-keyout",
      "self.key",
      "-out",
      "self.crt"
    );
    // A home certificate authority whose server sends only its own certificate: #703.
    openssl(
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "2",
      "-subj",
      "/CN=Home CA",
      "-keyout",
      "ca.key",
      "-out",
      "ca.crt"
    );
    openssl(
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-subj",
      "/CN=localhost",
      "-keyout",
      "leaf.key",
      "-out",
      "leaf.csr"
    );
    writeFileSync(file("ext"), "subjectAltName=DNS:localhost\n");
    openssl(
      "x509",
      "-req",
      "-in",
      "leaf.csr",
      "-CA",
      "ca.crt",
      "-CAkey",
      "ca.key",
      "-CAcreateserial",
      "-days",
      "2",
      "-extfile",
      "ext",
      "-out",
      "leaf.crt"
    );

    selfSigned = await serve(read("self.key"), read("self.crt"));
    homeCa = await serve(read("leaf.key"), read("leaf.crt"));
  });

  afterAll(() => {
    selfSigned?.close();
    homeCa?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("refuses a self-signed server by default, as an untrusted chain", async () => {
    expect(isUntrustedChain(await refusal(selfSigned.url))).toBe(true);
  });

  it("reads the certificate the server presents and trusts exactly that", async () => {
    const certificate = await readServerCertificate(selfSigned.url);

    expect(certificate).toMatchObject({ name: "localhost", pem: read("self.crt") });
    expect(certificate?.fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);

    const response = await fetchTrusting(certificate!.pem)(selfSigned.url);

    expect(await response.text()).toBe("ok");
  });

  it("trusts a home CA's server that sends only its own certificate", async () => {
    expect(isUntrustedChain(await refusal(homeCa.url))).toBe(true);

    const certificate = await readServerCertificate(homeCa.url);

    expect(certificate?.pem).toBe(read("leaf.crt"));
    expect((await fetchTrusting(certificate!.pem)(homeCa.url)).ok).toBe(true);
  });

  it("does not let a trusted certificate stand in for another host", async () => {
    const otherHost = selfSigned.url.replace("localhost", "127.0.0.1");
    const error = await fetchTrusting(read("self.crt"))(otherHost).then(
      () => null,
      (e: unknown) => e
    );

    expect(error).not.toBeNull();
    expect(isUntrustedChain(error)).toBe(false);
    expect(await readServerCertificate(otherHost)).toBeNull();
  });

  it("does not trust a different certificate than the one pinned", async () => {
    expect(
      isUntrustedChain(await fetchTrusting(read("self.crt"))(homeCa.url).catch((e) => e))
    ).toBe(true);
  });

  it("knows a certificate from anything else", () => {
    expect(isCertificate(read("self.crt"))).toBe(true);
    expect(isCertificate("-----BEGIN CERTIFICATE-----\nnope\n-----END CERTIFICATE-----")).toBe(
      false
    );
  });
});
