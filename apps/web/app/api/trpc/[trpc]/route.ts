import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createContext } from "@norish/trpc/server";

export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    // Next.js strips the base path before a Route Handler sees the request, so
    // the endpoint it matches stays bare. The client carries the prefix.
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
