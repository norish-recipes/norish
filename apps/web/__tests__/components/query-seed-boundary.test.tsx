import { QuerySeedBoundary } from "@/components/query-seed-boundary";
import { dehydrate, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/query-cache", () => ({ markServerCopies: () => {} }));

const KEY = ["library"];

function Read({ label }: { label: string }) {
  const { data } = useQuery({ queryKey: KEY, queryFn: () => "fetched", enabled: false });

  return <p>{`${label}: ${data ?? "nothing"}`}</p>;
}

function seeded() {
  const server = new QueryClient();

  server.setQueryData(KEY, "served");

  return dehydrate(server);
}

describe("QuerySeedBoundary", () => {
  it("fills, during render, a seeded query a provider above already watches", () => {
    const html = renderToString(
      <QueryClientProvider client={new QueryClient()}>
        <Read label="above" />
        <QuerySeedBoundary state={seeded()}>
          <Read label="below" />
        </QuerySeedBoundary>
      </QueryClientProvider>
    );

    // The watcher above rendered before the seed; what the page below draws is the server's.
    expect(html).toContain("above: nothing");
    expect(html).toContain("below: served");
  });

  it("leaves a query that already holds data to HydrationBoundary", () => {
    const client = new QueryClient();

    client.setQueryData(KEY, "restored");
    const html = renderToString(
      <QueryClientProvider client={client}>
        <QuerySeedBoundary state={seeded()}>
          <Read label="below" />
        </QuerySeedBoundary>
      </QueryClientProvider>
    );

    expect(html).toContain("below: restored");
  });
});
