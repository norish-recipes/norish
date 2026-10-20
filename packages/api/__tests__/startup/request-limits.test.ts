// @vitest-environment node
import http from "node:http";
import net from "node:net";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MAX_BULK_IMAGE_BATCH_BODY_BYTES } from "@norish/shared/contracts";

import { writeClientError } from "../../src/startup/client-errors";
import {
  BULK_IMAGE_IMPORT_PATH,
  bulkImageImportLimitVerdict,
  rejectBulkImageImportLimit,
} from "../../src/startup/request-limits";

const URL = `/api/trpc/${BULK_IMAGE_IMPORT_PATH}?batch=1`;
const OTHER_URL = "/api/trpc/recipes.importFromImages";

function request(url: string, headers: Record<string, string> = {}): IncomingMessage {
  return { url, headers, destroy: vi.fn() } as unknown as IncomingMessage;
}

function response() {
  const mock = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };

  return { res: mock as unknown as ServerResponse, mock };
}

describe("bulkImageImportLimitVerdict", () => {
  it("refuses a batch body over the multipart cap", () => {
    expect(
      bulkImageImportLimitVerdict(URL, String(MAX_BULK_IMAGE_BATCH_BODY_BYTES + 1), undefined)
    ).toBe("too-large");
  });

  it("allows a batch body at the cap", () => {
    expect(
      bulkImageImportLimitVerdict(URL, String(MAX_BULK_IMAGE_BATCH_BODY_BYTES), undefined)
    ).toBe("allow");
  });

  it("refuses a batch body with no Content-Length", () => {
    expect(bulkImageImportLimitVerdict(URL, undefined, undefined)).toBe("length-required");
  });

  it("refuses a chunked batch body", () => {
    expect(bulkImageImportLimitVerdict(URL, undefined, "chunked")).toBe("length-required");
  });

  it("refuses a chunked batch body that also declares a length", () => {
    expect(bulkImageImportLimitVerdict(URL, "1024", "chunked")).toBe("length-required");
  });

  it("refuses a percent-encoded batch path", () => {
    expect(
      bulkImageImportLimitVerdict(
        "/api/trpc/recipes%2EimportFromImagesBatch?batch=1",
        undefined,
        undefined
      )
    ).toBe("length-required");
  });

  it("refuses a partially encoded batch path", () => {
    expect(
      bulkImageImportLimitVerdict(
        "/api/trpc/recipes.importFromImages%42atch?batch=1",
        undefined,
        "chunked"
      )
    ).toBe("length-required");
  });

  it("refuses a double-encoded batch path", () => {
    expect(
      bulkImageImportLimitVerdict(
        "/api/trpc/recipes%252EimportFromImagesBatch?batch=1",
        undefined,
        "chunked"
      )
    ).toBe("length-required");
  });

  it("refuses a malformed escape in a tRPC path", () => {
    expect(bulkImageImportLimitVerdict("/api/trpc/recipes%ZZ", undefined, undefined)).toBe(
      "length-required"
    );
  });

  it("refuses a malformed length", () => {
    expect(bulkImageImportLimitVerdict(URL, "not-a-number", undefined)).toBe("length-required");
  });

  it("does not limit another tRPC path", () => {
    expect(
      bulkImageImportLimitVerdict(OTHER_URL, String(MAX_BULK_IMAGE_BATCH_BODY_BYTES + 1), undefined)
    ).toBe("allow");
  });

  it("allows an ordinary non-batch request with no length", () => {
    expect(bulkImageImportLimitVerdict(OTHER_URL, undefined, undefined)).toBe("allow");
  });
});

describe("rejectBulkImageImportLimit", () => {
  it("writes 413 for a declared body over the cap", () => {
    const { res, mock } = response();
    const req = request(URL, { "content-length": String(MAX_BULK_IMAGE_BATCH_BODY_BYTES + 1) });

    expect(rejectBulkImageImportLimit(req, res)).toBe(true);
    expect(res.statusCode).toBe(413);
    expect(mock.setHeader).toHaveBeenCalledWith("connection", "close");
    expect(mock.end).toHaveBeenCalledWith("Payload too large");
    expect(req.destroy).toHaveBeenCalled();
  });

  it("writes 411 when the batch body has no Content-Length", () => {
    const { res, mock } = response();

    expect(rejectBulkImageImportLimit(request(URL), res)).toBe(true);
    expect(res.statusCode).toBe(411);
    expect(mock.end).toHaveBeenCalledWith("Length required");
  });

  it("writes 411 for a chunked batch body", () => {
    const { res, mock } = response();

    expect(rejectBulkImageImportLimit(request(URL, { "transfer-encoding": "chunked" }), res)).toBe(
      true
    );
    expect(res.statusCode).toBe(411);
    expect(mock.end).toHaveBeenCalledWith("Length required");
  });

  it("lets an ordinary non-batch request through", () => {
    const { res, mock } = response();

    expect(rejectBulkImageImportLimit(request(OTHER_URL), res)).toBe(false);
    expect(res.statusCode).toBe(0);
    expect(mock.end).not.toHaveBeenCalled();
  });

  it("lets a batch body at the cap through", () => {
    const { res, mock } = response();

    expect(
      rejectBulkImageImportLimit(
        request(URL, { "content-length": String(MAX_BULK_IMAGE_BATCH_BODY_BYTES) }),
        res
      )
    ).toBe(false);
    expect(mock.end).not.toHaveBeenCalled();
  });
});

describe("bulk image import request guard over HTTP", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (rejectBulkImageImportLimit(req, res)) return;

      res.statusCode = 200;
      res.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    const address = server.address() as AddressInfo;

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function post(
    headers: http.OutgoingHttpHeaders,
    body = "",
    path = `/api/trpc/${BULK_IMAGE_IMPORT_PATH}?batch=1`
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}${path}`, { method: "POST", headers }, (res) => {
        let responseBody = "";

        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: responseBody }));
      });

      req.on("error", reject);
      req.end(body);
    });
  }

  it("answers 413 to a declared body over the cap", async () => {
    const response = await post({
      "content-length": String(MAX_BULK_IMAGE_BATCH_BODY_BYTES + 1),
    });

    expect(response.status).toBe(413);
  });

  it("answers 411 to a chunked body with no Content-Length", async () => {
    const response = await post({ "transfer-encoding": "chunked" }, "hello");

    expect(response.status).toBe(411);
  });

  it("answers 411 to a percent-encoded batch path", async () => {
    const response = await post(
      { "transfer-encoding": "chunked" },
      "hello",
      "/api/trpc/recipes%2EimportFromImagesBatch?batch=1"
    );

    expect(response.status).toBe(411);
  });

  it("answers 411 to a partially encoded batch path", async () => {
    const response = await post(
      { "transfer-encoding": "chunked" },
      "hello",
      "/api/trpc/recipes.importFromImages%42atch?batch=1"
    );

    expect(response.status).toBe(411);
  });

  it("answers 411 to a double-encoded batch path", async () => {
    const response = await post(
      { "transfer-encoding": "chunked" },
      "hello",
      "/api/trpc/recipes%252EimportFromImagesBatch?batch=1"
    );

    expect(response.status).toBe(411);
  });

  it("still serves an ordinary non-batch request", async () => {
    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http
        .get(`${baseUrl}/api/trpc/recipes.importFromImages`, (res) => {
          let responseBody = "";

          res.setEncoding("utf8");
          res.on("data", (chunk: string) => {
            responseBody += chunk;
          });
          res.on("end", () => resolve({ status: res.statusCode ?? 0, body: responseBody }));
        })
        .on("error", reject);
    });

    expect(response).toEqual({ status: 200, body: "ok" });
  });
});

describe("writeClientError", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((_req, res) => res.end("ok"));
    server.on("clientError", (error, socket) => writeClientError(error, socket));

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function raw(payload: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(port, "127.0.0.1", () => socket.write(payload));
      let response = "";

      socket.setEncoding("utf8");
      socket.on("data", (chunk: string) => {
        response += chunk;
      });
      socket.on("close", () => resolve(response));
      socket.on("error", reject);
    });
  }

  it.each([
    ["a non-numeric length", "nope"],
    ["a negative length", "-1"],
    ["a blank length", ""],
  ])("answers 411 for %s", async (_label, value) => {
    const response = await raw(
      `POST /api/trpc/${BULK_IMAGE_IMPORT_PATH} HTTP/1.1\r\nHost: test\r\nContent-Length: ${value}\r\n\r\n`
    );

    expect(response.split("\r\n")[0]).toBe("HTTP/1.1 411 Length Required");
  });

  it("answers 411 when Content-Length and Transfer-Encoding both appear", async () => {
    const response = await raw(
      `POST /api/trpc/${BULK_IMAGE_IMPORT_PATH} HTTP/1.1\r\nHost: test\r\nContent-Length: 5\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n`
    );

    expect(response.split("\r\n")[0]).toBe("HTTP/1.1 411 Length Required");
  });

  it("keeps 400 for another parse error", async () => {
    const response = await raw("GET / HTTP/1.1\r\nHost: test\r\nBad Header\r\n\r\n");

    expect(response.split("\r\n")[0]).toBe("HTTP/1.1 400 Bad Request");
  });
});
