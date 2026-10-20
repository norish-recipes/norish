import { BulkImportProvider, useBulkImport } from "@/context/bulk-import-context";
import { BULK_IMPORT_STORAGE_KEY } from "@/context/bulk-import-state";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportBatchDTO } from "@norish/shared/contracts";

const mocks = vi.hoisted(() => ({
  data: undefined as ImageImportBatchDTO | null | undefined,
  isSuccess: false,
  mutate: vi.fn(),
}));

const trpcMock = {
  recipes: {
    imageImportBatchStatus: {
      queryOptions: ({ batchId }: { batchId: string }) => ({
        queryKey: ["recipes", "imageImportBatchStatus", { batchId }],
        queryFn: async () => null,
      }),
      queryKey: ({ batchId }: { batchId: string }) => [
        "recipes",
        "imageImportBatchStatus",
        { batchId },
      ],
    },
    retryImageBatchItems: {
      mutationOptions: (options: unknown) => ({ ...(options as object), mutationFn: vi.fn() }),
    },
  },
  library: {
    list: {
      pathKey: () => ["library", "list"],
    },
  },
};

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => trpcMock,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();

  return {
    ...actual,
    useQuery: () => ({ data: mocks.data, isSuccess: mocks.isSuccess }),
    useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
  };
});

vi.mock("@/lib/ui/safe-error-toast", () => ({
  showSafeErrorToast: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

function Probe() {
  const { activeCount, batch, items, trackBatch, clearBatch, retry } = useBulkImport();

  return (
    <div>
      <output data-testid="count">{activeCount}</output>
      <output data-testid="batch">{batch?.batchId ?? "none"}</output>
      {items.map((item) => (
        <span data-testid={`item-${item.position}`} key={item.itemId}>
          {`${item.filename}|${item.status}|${item.previewUrl ?? "none"}`}
        </span>
      ))}
      <button
        type="button"
        onClick={() =>
          trackBatch("batch-1", [
            new File([new Uint8Array(4)], "one.png", { type: "image/png" }),
            new File([new Uint8Array(4)], "two.png", { type: "image/png" }),
          ])
        }
      >
        track
      </button>
      <button type="button" onClick={clearBatch}>
        clear
      </button>
      <button type="button" onClick={() => retry(items.filter((item) => item.status === "failed"))}>
        retry
      </button>
    </div>
  );
}

function batchDTO(
  items: {
    itemId: string;
    position: number;
    filename: string;
    status: ImageImportBatchDTO["items"][number]["status"];
    errorCode?: ImageImportBatchDTO["items"][number]["errorCode"];
    retryable?: boolean;
  }[]
): ImageImportBatchDTO {
  return {
    batchId: "batch-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    items: items.map((item) => ({
      itemId: item.itemId,
      position: item.position,
      filename: item.filename,
      status: item.status,
      errorCode: item.errorCode ?? null,
      recipeId: null,
      retryable: item.retryable ?? false,
    })),
  };
}

let queryClient: QueryClient;
function renderProvider() {
  return render(
    <QueryClientProvider client={queryClient}>
      <BulkImportProvider>
        <Probe />
      </BulkImportProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.data = undefined;
  mocks.isSuccess = false;
  mocks.mutate.mockReset();
  window.sessionStorage.clear();

  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn((file: File) => `blob:${file.name}`),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("BulkImportProvider", () => {
  it("registers a batch as queued items with memory previews and persists its metadata", async () => {
    renderProvider();

    fireEvent.click(screen.getByText("track"));

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(screen.getByTestId("item-0")).toHaveTextContent("one.png|queued|blob:one.png");
    expect(screen.getByTestId("item-1")).toHaveTextContent("two.png|queued|blob:two.png");

    const stored = JSON.parse(window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY) ?? "{}");

    expect(stored.batchId).toBe("batch-1");
    expect(stored.items).toHaveLength(2);
    expect(stored.items[0]).toMatchObject({ filename: "one.png", status: "queued" });
    expect(stored.items[0]).not.toHaveProperty("previewUrl");
  });

  it("drops a done card, invalidates the library, and keeps a failed card for retry", async () => {
    const view = renderProvider();

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(screen.getByText("track"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    mocks.data = batchDTO([
      {
        itemId: "item-1",
        position: 0,
        filename: "one.png",
        status: "done",
      },
      {
        itemId: "item-2",
        position: 1,
        filename: "two.png",
        status: "failed",
        errorCode: "extraction-failed",
        retryable: true,
      },
    ]);
    mocks.isSuccess = true;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <BulkImportProvider>
          <Probe />
        </BulkImportProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.queryByTestId("item-0")).not.toBeInTheDocument());
    expect(screen.getByTestId("item-1")).toHaveTextContent("two.png|failed|blob:two.png");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("batch")).toHaveTextContent("batch-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["library", "list"] });

    fireEvent.click(screen.getByText("retry"));

    expect(mocks.mutate).toHaveBeenCalledWith({ batchId: "batch-1", itemIds: ["item-2"] });
  });

  it("keeps a settled batch and its results until clear", async () => {
    const view = renderProvider();

    fireEvent.click(screen.getByText("track"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    mocks.data = batchDTO([
      {
        itemId: "item-1",
        position: 0,
        filename: "one.png",
        status: "done",
      },
      {
        itemId: "item-2",
        position: 1,
        filename: "two.png",
        status: "failed",
        errorCode: "extraction-failed",
      },
    ]);
    mocks.isSuccess = true;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <BulkImportProvider>
          <Probe />
        </BulkImportProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("batch")).toHaveTextContent("batch-1"));
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.queryByTestId("item-0")).not.toBeInTheDocument();
    expect(screen.getByTestId("item-1")).toHaveTextContent("two.png|failed|blob:two.png");

    const stored = JSON.parse(window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY) ?? "{}");

    expect(stored.batchId).toBe("batch-1");
    expect(stored.items).toHaveLength(1);

    mocks.data = undefined;
    mocks.isSuccess = false;

    fireEvent.click(screen.getByText("clear"));

    expect(screen.getByTestId("batch")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY)).toBeNull();
  });

  it("restores a batch from session storage without previews", async () => {
    window.sessionStorage.setItem(
      BULK_IMPORT_STORAGE_KEY,
      JSON.stringify({
        batchId: "batch-9",
        items: [
          {
            itemId: "item-9",
            position: 0,
            filename: "saved.png",
            status: "processing",
            recipeId: null,
            errorCode: null,
          },
        ],
      })
    );

    renderProvider();

    await waitFor(() =>
      expect(screen.getByTestId("item-0")).toHaveTextContent("saved.png|processing|none")
    );
    expect(screen.getByTestId("count")).toHaveTextContent("1");
  });

  it("clears the batch when the status query answers with no batch", async () => {
    const view = renderProvider();

    fireEvent.click(screen.getByText("track"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    mocks.data = null;
    mocks.isSuccess = true;
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <BulkImportProvider>
          <Probe />
        </BulkImportProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
    expect(screen.getByTestId("batch")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY)).toBeNull();
  });

  it("clears on request", async () => {
    renderProvider();

    fireEvent.click(screen.getByText("track"));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

    fireEvent.click(screen.getByText("clear"));

    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("batch")).toHaveTextContent("none");
    expect(window.sessionStorage.getItem(BULK_IMPORT_STORAGE_KEY)).toBeNull();
  });
});
