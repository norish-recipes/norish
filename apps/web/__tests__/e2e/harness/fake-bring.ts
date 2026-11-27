/**
 * Bring!, served by the harness. The browser tests never reach the real service: it would need the
 * instance on the public internet, and it would be someone else's servers fetching our page.
 *
 * It answers Bring!'s two import endpoints. `GET /rest/bringrecipes/parser` and
 * `POST /rest/bringrecipes/deeplink` both fetch the page they were given at once and with no
 * cookie, as Bring!'s own servers do, so the request is the proof that the page needs no session.
 * Opening a deeplink reads the page again, as the import does in the Bring! app, so what it got is
 * the list as it was when the reader pressed.
 * `breakPages()` has the parser get a 404, which the real one reports as "not reachable" with the
 * status; `refuse()` makes the deeplink endpoint answer 403, a refusal of the page as such;
 * `hold()` keeps the deeplink endpoint from answering until it is let go.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

export interface BringRequestBody {
  url: string;
  baseQuantity?: string;
  requestedQuantity?: string;
  source?: string;
}

export interface BringRequest {
  /** The JSON body the instance sent. */
  body: BringRequestBody;
  /** The status the fake got fetching `body.url` with no cookie. */
  pageStatus: number;
  /** The HTML it got. */
  pageHtml: string;
}

export interface BringOpen {
  /** The deeplink's path. */
  path: string;
  /** The status the fake got fetching the deeplink's page with no cookie when it was opened. */
  pageStatus: number;
  /** The HTML it got. */
  pageHtml: string;
}

export interface FakeBring {
  /** The address to give the server as `BRING_API_URL`. */
  url: string;
  /** Every deeplink request, in order. */
  requests: BringRequest[];
  /** The deeplinks that were opened, in order, with the page each read then. */
  opened: BringOpen[];
  /** The page URLs the recipe parser was asked to read, in order. */
  parsed: string[];
  /** Have the deeplink endpoint answer 403 from now on, so preparing ends in `bring-rejected`. */
  refuse: () => void;
  /** Have the recipe parser get a 404 from the instance, as when Bring!'s servers cannot reach the page. */
  breakPages: () => void;
  /** Keep the deeplink endpoint from answering until the function it returns is called. */
  hold: () => () => void;
  /** Answer as usual again, and forget what was recorded. */
  reset: () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.once("error", reject);
  });
}

export function createFakeBring(): FakeBring {
  const requests: BringRequest[] = [];
  const opened: BringOpen[] = [];
  const parsed: string[] = [];
  let refusing = false;
  let breaking = false;
  let held: Promise<void> = Promise.resolve();
  let release = () => {};
  let server: Server | null = null;
  let url = "";

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = request.url ?? "/";

    if (request.method === "POST" && path === "/rest/bringrecipes/deeplink") {
      const body = JSON.parse(await readBody(request)) as BringRequestBody;
      // No cookie, no header of ours: this is a stranger on the internet.
      const page = await fetch(body.url);
      const pageHtml = await page.text();

      requests.push({ body, pageStatus: page.status, pageHtml });
      await held;

      if (refusing) {
        response.writeHead(403, { "content-type": "application/json" });
        response.end(JSON.stringify({ message: "Forbidden" }));

        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ deeplink: `${url}/deeplink/${requests.length}` }));

      return;
    }

    // Bring!'s recipe parser, which the deeplink's import page calls: it fetches the page, again
    // with no cookie, and answers 400 with the status it got, as the real one does.
    if (request.method === "GET" && path.startsWith("/rest/bringrecipes/parser?")) {
      const pageUrl = new URL(path, url).searchParams.get("url") ?? "";
      // Broken pages: the same address with a token that was never handed out.
      const page = await fetch(
        breaking ? `${pageUrl.slice(0, pageUrl.lastIndexOf("/") + 1)}${"A".repeat(32)}` : pageUrl
      );
      const html = await page.text();

      parsed.push(pageUrl);

      if (!page.ok) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            title: "Bad Request",
            status: 400,
            detail: `recipe url is not reachable: method=GET, httpStatus=${page.status}, httpMessage='${page.statusText}'`,
          })
        );

        return;
      }
      if (!html.includes('"@type":"Recipe"')) {
        response.writeHead(400, { "content-type": "text/plain" });
        response.end("invalid recipe parsed: no recipe name found");

        return;
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ items: [] }));

      return;
    }

    if (request.method === "GET" && path.startsWith("/deeplink/")) {
      const sent = requests[Number(path.slice("/deeplink/".length)) - 1];
      const page = sent ? await fetch(sent.body.url) : null;

      opened.push({ path, pageStatus: page?.status ?? 0, pageHtml: (await page?.text()) ?? "" });
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>Bring!</title><h1>Bring! (fake)</h1>");

      return;
    }

    response.writeHead(404).end();
  }

  return {
    get url() {
      return url;
    },
    requests,
    opened,
    parsed,
    refuse: () => {
      refusing = true;
    },
    breakPages: () => {
      breaking = true;
    },
    hold: () => {
      held = new Promise((resolve) => {
        release = () => resolve();
      });

      return release;
    },
    reset: () => {
      release();
      held = Promise.resolve();
      refusing = false;
      breaking = false;
      requests.length = 0;
      opened.length = 0;
      parsed.length = 0;
    },
    start: () =>
      new Promise((resolve, reject) => {
        const created = createServer((request, response) => {
          void handle(request, response).catch(() => {
            if (!response.headersSent) response.writeHead(500);
            response.end();
          });
        });

        created.once("error", reject);
        created.listen(0, "127.0.0.1", () => {
          const address = created.address();

          if (typeof address === "string" || address === null) {
            reject(new Error("The fake Bring! did not get a port"));

            return;
          }
          server = created;
          url = `http://127.0.0.1:${address.port}`;
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        if (!server) {
          resolve();

          return;
        }
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
        server = null;
      }),
  };
}
