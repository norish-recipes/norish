import { auth } from "@norish/auth/auth";
import { BASE_PATH } from "@norish/shared/lib/base-path";

/**
 * Next.js strips the instance base path before a Route Handler runs, while
 * Better Auth matches its `basePath` against the full public route. Put the
 * prefix back on the URL the auth handler sees (ADR-0040).
 */
async function withInstancePrefix(request: Request): Promise<Request> {
  if (!BASE_PATH) return request;

  const url = new URL(request.url);

  if (url.pathname === BASE_PATH || url.pathname.startsWith(`${BASE_PATH}/`)) {
    return request;
  }

  url.pathname = `${BASE_PATH}${url.pathname}`;

  return new Request(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    duplex: "half",
  } as RequestInit);
}

export const GET = async (request: Request) => auth.handler(await withInstancePrefix(request));
export const POST = async (request: Request) => auth.handler(await withInstancePrefix(request));
