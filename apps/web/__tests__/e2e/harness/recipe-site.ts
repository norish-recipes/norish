/**
 * An https recipe site on every `*.localhost` name, which Chromium resolves to loopback. Its first
 * answer sets a cookie and reloads, as Akamai's does; `/to/elsewhere` redirects to it on `elsewhere`.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IncomingHttpHeaders, Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface SiteRequest {
  /** The name it was asked under, without the port */
  host: string;
  path: string;
  headers: IncomingHttpHeaders;
}

export interface RecipeSite {
  /** The site's address under this name, such as `https://recipes.localhost:41234` */
  origin: (name: string) => string;
  /** Every request the site was sent, in order */
  requests: SiteRequest[];
  close: () => Promise<void>;
}

/** A certificate for this run alone; a browser started with `--ignore-certificate-errors` takes it. */
function selfSignedCertificate(): { key: Buffer; cert: Buffer } {
  const dir = mkdtempSync(path.join(tmpdir(), "norish-e2e-tls-"));
  const [key, cert] = [path.join(dir, "key.pem"), path.join(dir, "cert.pem")];

  try {
    execFileSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- the machine's own openssl
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-keyout",
        key,
        "-out",
        cert,
      ],
      { stdio: "ignore" }
    );

    return { key: readFileSync(key), cert: readFileSync(cert) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function recipePage(name: string): string {
  const recipe = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name,
    recipeIngredient: ["2 eggs", "100 g flour"],
    recipeInstructions: [{ "@type": "HowToStep", text: "Whisk the eggs into the flour." }],
  };

  return `<!doctype html><html><head><title>${name}</title><script type="application/ld+json">${JSON.stringify(recipe)}</script></head><body><h1>${name}</h1></body></html>`;
}

/** No title and a few hundred bytes, which is what Norish reads as a bot check. */
const CHALLENGE = `<!doctype html><html><head><script>document.cookie = "passed=1; path=/"; setTimeout(() => location.reload(), 300);</script></head><body></body></html>`;

/** Serve the recipe named `name` at `/recipe`, behind the challenge. */
export async function serveRecipeSite(name: string): Promise<RecipeSite> {
  const requests: SiteRequest[] = [];
  const server: Server = createServer(selfSignedCertificate(), (request, response) => {
    const host = (request.headers.host ?? "").replace(/:\d+$/, "");
    const passed = /(?:^|;\s*)passed=1/.test(request.headers.cookie ?? "");

    requests.push({ host, path: request.url ?? "/", headers: request.headers });

    if (request.url === "/to/elsewhere") {
      const { port } = server.address() as AddressInfo;

      response.writeHead(302, { location: `https://elsewhere.localhost:${port}/recipe` }).end();

      return;
    }

    response.writeHead(request.url === "/recipe" ? 200 : 404, {
      "content-type": "text/html; charset=utf-8",
    });
    response.end(request.url === "/recipe" && passed ? recipePage(name) : CHALLENGE);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const { port } = server.address() as AddressInfo;

  return {
    origin: (host) => `https://${host}.localhost:${port}`,
    requests,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
