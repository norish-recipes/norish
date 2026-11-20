import { serverPackage } from "@/lib/server-package";

import { addBasePath, BASE_PATH } from "@norish/shared/lib/base-path";

const { auth } = await serverPackage<typeof import("@norish/auth/auth")>("@norish/auth/auth");

// Next strips the base path before a Route Handler runs; Better Auth routes on the public path.
function withBasePath(request: Request): Request {
  if (!BASE_PATH) return request;

  const url = new URL(request.url);

  url.pathname = addBasePath(url.pathname);

  return new Request(url, request);
}

export const GET = (request: Request) => auth.handler(withBasePath(request));
export const POST = (request: Request) => auth.handler(withBasePath(request));
