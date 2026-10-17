import "server-only";

import type { DehydratedState } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { QuerySeedBoundary } from "@/components/query-seed-boundary";
import { isDocumentRequest } from "@/lib/document-request";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";
import { appRouter, createHttpContextFromHeaders } from "@norish/trpc/server";

/** Each read a page seeds; `false` or `undefined` for one it leaves out. */
type Seeds = (Promise<unknown> | false | undefined)[];
type Reads = (
  trpc: TRPCOptionsProxy<AppRouter>,
  queryClient: QueryClient
) => Seeds | Promise<Seeds>;

/**
 * On a full load, the reads a first frame needs, ready for the browser's query cache; a failed
 * read is left to the page. An in-app navigation reads nothing.
 */
export async function readQuerySeed(reads: Reads): Promise<DehydratedState | undefined> {
  const requestHeaders = await headers();

  // Next hides its RSC headers from headers(), so Sec-Fetch-Dest (or the worker's own header)
  // tells a full load from an in-app navigation or prefetch, which gets no seed.
  if (!isDocumentRequest(requestHeaders)) return undefined;

  const queryClient = new QueryClient();
  const ctx = await createHttpContextFromHeaders(new Headers(requestHeaders), null);

  await Promise.allSettled(
    await reads(createTRPCOptionsProxy({ router: appRouter, ctx, queryClient }), queryClient)
  );

  return dehydrate(queryClient);
}

/** A page's reads, sent with the document into the browser's query cache. */
export async function QuerySeed({ children, reads }: { children: ReactNode; reads: Reads }) {
  // Always the boundary, so a refresh of the same page keeps its tree.
  return <QuerySeedBoundary state={await readQuerySeed(reads)}>{children}</QuerySeedBoundary>;
}
