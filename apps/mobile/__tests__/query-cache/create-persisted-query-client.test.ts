import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPersistedQueryClient } from "../../src/lib/query-cache/create-persisted-query-client";

const mockPersistQueryClientRestore = vi.fn((_options: unknown) => Promise.resolve());
const mockPersistQueryClientSubscribe = vi.fn((_options: unknown) => undefined);

vi.mock("@tanstack/query-persist-client-core", () => ({
  persistQueryClientRestore: (options: unknown) => mockPersistQueryClientRestore(options),
  persistQueryClientSubscribe: (options: unknown) => mockPersistQueryClientSubscribe(options),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      version: "1.2.3",
    },
    manifest2: null,
  },
}));

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/storage/query-cache-mmkv", () => ({
  queryCacheStorage: {
    set: vi.fn(),
    getString: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("createPersistedQueryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("configures mutations to fail fast instead of pausing offline", async () => {
    const { queryClient, restorePromise } = createPersistedQueryClient();

    await restorePromise;

    expect(queryClient.getDefaultOptions().mutations).toMatchObject({
      networkMode: "always",
      retry: 0,
    });
  });

  it("restores and subscribes with the expected persistence settings", async () => {
    const { queryClient, restorePromise } = createPersistedQueryClient();

    await restorePromise;

    expect(mockPersistQueryClientRestore).toHaveBeenCalledWith(
      expect.objectContaining({
        queryClient,
        persister: expect.any(Object),
        maxAge: 1000 * 60 * 60 * 24,
        buster: "1.2.3",
      })
    );

    expect(mockPersistQueryClientSubscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        queryClient,
        persister: expect.any(Object),
        buster: "1.2.3",
        dehydrateOptions: expect.objectContaining({
          shouldDehydrateQuery: expect.any(Function),
        }),
      })
    );

    const subscribeOptions = mockPersistQueryClientSubscribe.mock.calls[0]?.[0] as
      | {
          dehydrateOptions?: {
            shouldDehydrateQuery?: (query: { state: { status: string } }) => boolean;
          };
        }
      | undefined;
    const shouldDehydrateQuery = subscribeOptions?.dehydrateOptions?.shouldDehydrateQuery;

    expect(shouldDehydrateQuery?.({ state: { status: "success" } })).toBe(true);
    expect(shouldDehydrateQuery?.({ state: { status: "error" } })).toBe(false);
  });
});
