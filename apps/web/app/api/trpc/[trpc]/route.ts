import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createContext } from "@norish/trpc/server";

export const maxDuration = 300;

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    // Reads that can carry a secret are sent as POST, see trpc-links.
    allowMethodOverride: true,
  });

export { handler as GET, handler as POST };
