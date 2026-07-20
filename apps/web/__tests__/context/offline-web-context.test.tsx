import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StrictMode, useMemo } from "react";
import { TRPCProviderWrapper, useTRPC } from "@/app/providers/trpc-provider";
import { OfflineWebProvider, useOfflineWeb } from "@/context/offline-web-context";
import { WebConnectivityRuntime } from "@/lib/connectivity";
import { WebReadCacheRepository } from "@/lib/offline-read-cache";
import { createOfflineReadCacheRegistry } from "@/lib/offline-read-cache/query-registry";
import { onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

const auth = vi.hoisted(() => ({
  session: {
    data: null,
    error: null,
    isPending: false,
  } as {
    data: { user: { id: string; email: string; name: string; image: string | null } } | null;
    error: Error | null;
    isPending: boolean;
  },
  getSession: vi.fn(),
}));

vi.mock("@norish/shared/lib/auth/client", () => ({
  useSession: () => auth.session,
  getSession: auth.getSession,
}));

type QueryMode = "healthy" | "offline" | "domain-error" | "deferred";
type Keys = {
  dashboard: QueryKey;
  inactiveCalendar: QueryKey;
  household: QueryKey;
};

const USER = {
  id: "user-1",
  email: "user@example.com",
  name: "Offline User",
  image: null,
};
const SECOND_USER = {
  id: "user-2",
  email: "second@example.com",
  name: "Second User",
  image: null,
};
const HOUSEHOLD_DATA = {
  household: { id: "household-1", name: "Home" },
  currentUserId: USER.id,
};
const SECOND_HOUSEHOLD_DATA = {
  household: { id: "household-2", name: "Other home" },
  currentUserId: SECOND_USER.id,
};
const SAME_USER_SECOND_HOUSEHOLD_DATA = {
  household: { id: "household-2", name: "Other home" },
  currentUserId: USER.id,
};
const PERSONAL_HOUSEHOLD_DATA = {
  household: null,
  currentUserId: USER.id,
};
const CACHED_DASHBOARD = {
  pages: [{ recipes: [{ id: "cached-recipe", name: "Cached" }], total: 1, nextCursor: null }],
  pageParams: [null],
};
const LIVE_DASHBOARD = {
  pages: [{ recipes: [{ id: "live-recipe", name: "Live" }], total: 1, nextCursor: null }],
  pageParams: [null],
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });

  return { promise, resolve };
}

function KeyProbe({ capture }: { capture: (keys: Keys) => void }) {
  const trpc = useTRPC();
  const registry = useMemo(() => createOfflineReadCacheRegistry(trpc), [trpc]);

  capture({
    dashboard: registry.dashboardQueryKey,
    inactiveCalendar: trpc.calendar.listItems.queryKey({
      startISO: "2026-07-01",
      endISO: "2026-07-31",
    }),
    household: registry.householdQueryKey,
  });

  return null;
}

function QueryClientProbe({ capture }: { capture: (queryClient: QueryClient) => void }) {
  capture(useQueryClient());

  return null;
}

function setNetworkQueryData(queryClient: QueryClient | null, queryKey: QueryKey, data: unknown) {
  const query = queryClient?.getQueryCache().find({ queryKey, exact: true });

  if (!query) throw new Error("Expected query to exist before simulating a network success");
  query.setData(data, { updatedAt: Date.now() });
}

function CachedCalendarHarness({
  failureGate,
  queryKey,
  runtime,
}: {
  failureGate?: Promise<void>;
  queryKey: QueryKey;
  runtime: WebConnectivityRuntime;
}) {
  const offline = useOfflineWeb();
  const calendar = useQuery({
    queryKey,
    queryFn: async () => {
      await failureGate;
      runtime.reportHttpFailure();
      throw new TypeError("Failed to fetch");
    },
    retry: false,
  });

  return (
    <output data-testid="cached-calendar-state">
      {JSON.stringify({
        itemId: (calendar.data as Array<{ id: string }> | undefined)?.[0]?.id ?? null,
        loadingFallback: offline.isQueryLoadingFallback(queryKey),
        usingCachedData: offline.isQueryUsingCachedData(queryKey),
        unavailable: offline.isQueryUnavailable(queryKey),
      })}
    </output>
  );
}

function getKeys(): Keys {
  let keys: Keys | null = null;
  const result = render(
    <TRPCProviderWrapper>
      <KeyProbe capture={(value) => (keys = value)} />
    </TRPCProviderWrapper>
  );

  result.unmount();
  if (!keys) throw new Error("tRPC query keys were not captured");

  return keys;
}

function ProviderTree({
  children,
  repository,
  runtime,
  deadline = 100,
}: {
  children: ReactNode;
  repository: WebReadCacheRepository;
  runtime: WebConnectivityRuntime;
  deadline?: number;
}) {
  return (
    <TRPCProviderWrapper>
      <OfflineWebProvider
        cacheRepository={repository}
        connectivityRuntime={runtime}
        fallbackDeadlineMs={deadline}
      >
        {children}
      </OfflineWebProvider>
    </TRPCProviderWrapper>
  );
}

function ReadHarness({
  mode,
  runtime,
  gate,
  householdData = HOUSEHOLD_DATA,
  dashboardData = LIVE_DASHBOARD,
  onDashboardRead,
}: {
  mode: QueryMode;
  runtime: WebConnectivityRuntime;
  gate?: Promise<void>;
  householdData?: {
    household: { id: string; name: string } | null;
    currentUserId: string;
  };
  dashboardData?: typeof LIVE_DASHBOARD;
  onDashboardRead?: () => void;
}) {
  const trpc = useTRPC();
  const registry = useMemo(() => createOfflineReadCacheRegistry(trpc), [trpc]);
  const offline = useOfflineWeb();

  const read = async <T,>(value: T): Promise<T> => {
    if (mode === "offline") {
      runtime.reportHttpFailure();
      throw new TypeError("Failed to fetch");
    }

    if (mode === "domain-error") {
      runtime.reportHttpSuccess();
      throw Object.assign(new Error("Validation failed"), {
        data: { code: "BAD_REQUEST", httpStatus: 422 },
      });
    }

    if (mode === "deferred") await gate;

    runtime.reportHttpSuccess();

    return value;
  };

  useQuery({
    queryKey: registry.householdQueryKey,
    queryFn: () => read(householdData),
    retry: false,
  });
  const dashboard = useQuery({
    queryKey: registry.dashboardQueryKey,
    queryFn: () => {
      onDashboardRead?.();

      return read(dashboardData);
    },
    retry: false,
  });
  return (
    <>
      <output data-testid="offline-state">
        {JSON.stringify({
          phase: offline.phase,
          source: dashboard.data?.pages[0]?.recipes[0]?.id ?? "none",
          loading: dashboard.isPending,
          unavailable: offline.isQueryUnavailable(registry.dashboardQueryKey),
          usingCachedData: offline.usingCachedData,
          cachedUpdatedAt: offline.getCachedQueryUpdatedAt(registry.dashboardQueryKey),
          renderUser: offline.renderUser?.id ?? null,
          inventoryRecords: offline.inventory.totalRecords,
          persistenceWarning: offline.persistenceWarning
            ? {
                code: offline.persistenceWarning.code,
                recordKind: offline.persistenceWarning.recordKind ?? null,
              }
            : null,
        })}
      </output>
      <button type="button" onClick={() => void offline.clearCachedData()}>
        clear cache
      </button>
    </>
  );
}

type HarnessState = {
  phase: string;
  source: string;
  loading: boolean;
  unavailable: boolean;
  usingCachedData: boolean;
  cachedUpdatedAt: number | null;
  renderUser: string | null;
  inventoryRecords: number;
  persistenceWarning: { code: string; recordKind: string | null } | null;
};

function state(): HarnessState {
  return JSON.parse(screen.getByTestId("offline-state").textContent ?? "{}") as HarnessState;
}

async function seedCache(
  repository: WebReadCacheRepository,
  keys: Keys,
  includeInactiveCalendar = false
) {
  const scope = await repository.confirmScope({
    backendOrigin: window.location.origin,
    userId: USER.id,
    householdId: HOUSEHOLD_DATA.household.id,
    renderUser: { ...USER, version: 1 },
    renderHousehold: HOUSEHOLD_DATA.household,
    householdQueryKey: keys.household,
    confirmedAt: 10,
    lastLiveSuccessAt: 10,
  });

  await repository.putRecord({
    scopeKey: scope.key,
    kind: "recipe-dashboard",
    queryKey: keys.dashboard,
    data: CACHED_DASHBOARD,
    dataUpdatedAt: 10,
    counts: { recipeSummaries: 1 },
    now: 11,
  });

  if (includeInactiveCalendar) {
    await repository.putRecord({
      scopeKey: scope.key,
      kind: "calendar-range",
      queryKey: keys.inactiveCalendar,
      data: [{ id: "inactive-calendar-item" }],
      dataUpdatedAt: 10,
      counts: { calendarItems: 1 },
      now: 12,
    });
  }
}

describe("OfflineWebProvider", () => {
  let factory: IDBFactory;
  let repository: WebReadCacheRepository;
  let runtime: WebConnectivityRuntime;

  beforeEach(() => {
    factory = new IDBFactory();
    repository = new WebReadCacheRepository({ factory });
    runtime = new WebConnectivityRuntime("test", window.localStorage);
    auth.session = { data: { user: USER }, error: null, isPending: false };
    auth.getSession.mockReset();
    auth.getSession.mockResolvedValue({ data: { user: USER }, error: null });
    vi.stubGlobal("indexedDB", factory);
    vi.stubGlobal("IDBKeyRange", IDBKeyRange);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 }))
    );
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a healthy fresh load live-first and asynchronously persists the real query keys", async () => {
    const keys = getKeys();

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() => expect(state()).toMatchObject({ phase: "live", source: "live-recipe" }));
    await waitFor(
      async () => {
        const scope = await repository.selectLastConfirmedScope(window.location.origin);

        expect(scope?.userId).toBe(USER.id);
        expect(scope ? await repository.listRecords(scope.key) : []).toEqual([
          expect.objectContaining({ kind: "recipe-dashboard", queryKey: keys.dashboard }),
        ]);
      },
      { timeout: 2_000 }
    );
  });

  it("does not persist manual optimistic QueryCache updates as successful reads", async () => {
    const keys = getKeys();
    let queryClient: QueryClient | null = null;

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
      </ProviderTree>
    );

    await waitFor(async () => {
      const scope = await repository.selectLastConfirmedScope(window.location.origin);
      const [record] = scope ? await repository.listRecords(scope.key) : [];

      expect(record?.data).toMatchObject(LIVE_DASHBOARD);
    });

    act(() => {
      queryClient?.setQueryData(keys.dashboard, {
        pages: [
          {
            recipes: [{ id: "optimistic-recipe", name: "Not confirmed" }],
            total: 1,
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 350));

    const scope = await repository.selectLastConfirmedScope(window.location.origin);
    const [record] = scope ? await repository.listRecords(scope.key) : [];

    expect(record?.data).toMatchObject(LIVE_DASHBOARD);
  });

  it("does not confirm a household scope from a manual QueryCache projection", async () => {
    const keys = getKeys();
    let queryClient: QueryClient | null = null;

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        householdId: HOUSEHOLD_DATA.household.id,
      });
    });
    act(() => {
      queryClient?.setQueryData(keys.household, SAME_USER_SECOND_HOUSEHOLD_DATA);
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
      householdId: HOUSEHOLD_DATA.household.id,
    });
  });

  it("identifies a failed record write and clears the warning after persistence recovers", async () => {
    let queryClient: QueryClient | null = null;
    const putRecord = repository.putRecord.bind(repository);

    vi.spyOn(repository, "putRecord")
      .mockRejectedValueOnce(new DOMException("Quota exceeded", "QuotaExceededError"))
      .mockImplementation(putRecord);

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state().persistenceWarning).toEqual({
        code: "quota-exceeded",
        recordKind: "recipe-dashboard",
      })
    );

    await act(async () => {
      await queryClient?.refetchQueries({ type: "active" });
    });

    await waitFor(() => expect(state().persistenceWarning).toBeNull());
    await waitFor(async () => {
      const scope = await repository.selectLastConfirmedScope(window.location.origin);

      expect(scope ? await repository.listRecords(scope.key) : []).toEqual([
        expect.objectContaining({ kind: "recipe-dashboard" }),
      ]);
    });
  });

  it("uses a scope created after startup when the first live visit later degrades", async () => {
    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      const scope = await repository.selectLastConfirmedScope(window.location.origin);

      expect(scope ? await repository.listRecords(scope.key) : []).toEqual([
        expect.objectContaining({ kind: "recipe-dashboard" }),
      ]);
    });

    act(() => runtime.reportHttpFailure());

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        unavailable: false,
        usingCachedData: false,
      })
    );
  });

  it("does not skip the initial live attempt when the browser reports offline", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const request = deferred();

    const rendered = render(
      <ProviderTree deadline={10_000} repository={repository} runtime={runtime}>
        <ReadHarness gate={request.promise} mode="deferred" runtime={runtime} />
      </ProviderTree>
    );

    act(() => window.dispatchEvent(new Event("offline")));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(runtime.getSnapshot()).toMatchObject({
      state: "offline",
      transportFailureConfirmed: false,
    });
    expect(state()).toMatchObject({
      phase: "probing-live",
      source: "none",
      loading: true,
      usingCachedData: false,
    });
    rendered.unmount();
    onlineManager.setOnline(true);
  });

  it("shows the existing pending state first, restores exact cached data at the deadline, and lets late live data win", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const request = deferred();

    render(
      <ProviderTree deadline={30} repository={repository} runtime={runtime}>
        <ReadHarness gate={request.promise} mode="deferred" runtime={runtime} />
      </ProviderTree>
    );

    expect(state()).toMatchObject({ phase: "probing-live", loading: true, source: "none" });
    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "cached",
        source: "cached-recipe",
        usingCachedData: true,
        cachedUpdatedAt: 10,
        renderUser: USER.id,
      })
    );

    await act(async () => request.resolve());
    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        usingCachedData: false,
        cachedUpdatedAt: null,
      })
    );
  });

  it("keeps unavailable states hidden while asynchronous fallback records are loading", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const recordsRequest = deferred();
    const listRecords = repository.listRecords.bind(repository);

    vi.spyOn(repository, "listRecords").mockImplementation(async (scopeKey) => {
      await recordsRequest.promise;

      return listRecords(scopeKey);
    });

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "loading-fallback",
        source: "none",
        unavailable: false,
      })
    );

    await act(async () => recordsRequest.resolve());
    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "cached",
        source: "cached-recipe",
        unavailable: false,
      })
    );
  });

  it("falls back immediately on transport failure and reports no-cache outages explicitly", async () => {
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "unavailable",
        source: "none",
        loading: false,
        unavailable: true,
      })
    );
  });

  it("evicts restored QueryClient data when the active read cache is cleared", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "cached",
        source: "cached-recipe",
        usingCachedData: true,
      })
    );
    const scope = await repository.selectLastConfirmedScope(window.location.origin);

    fireEvent.click(screen.getByRole("button", { name: "clear cache" }));

    await waitFor(() =>
      expect(state()).toMatchObject({
        source: "none",
        usingCachedData: false,
        inventoryRecords: 0,
        unavailable: true,
      })
    );
    expect(scope ? await repository.listRecords(scope.key) : []).toEqual([]);
  });

  it("rehydrates an inactive cached route after QueryClient garbage collection", async () => {
    const keys = getKeys();
    const consoleError = vi.spyOn(console, "error");

    await seedCache(repository, keys, true);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const calendarFailure = deferred();
    let queryClient: QueryClient | null = null;
    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
      </ProviderTree>
    );

    await waitFor(() => expect(state().phase).toBe("cached"));
    act(() => {
      queryClient?.removeQueries({ queryKey: keys.inactiveCalendar, exact: true });
    });
    expect(queryClient?.getQueryData(keys.inactiveCalendar)).toBeUndefined();

    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
        <CachedCalendarHarness
          failureGate={calendarFailure.promise}
          queryKey={keys.inactiveCalendar}
          runtime={runtime}
        />
      </ProviderTree>
    );

    const expectCachedCalendar = async () =>
      waitFor(() => {
        const value = JSON.parse(
          screen.getByTestId("cached-calendar-state").textContent ?? "{}"
        ) as {
          itemId: string | null;
          loadingFallback: boolean;
          unavailable: boolean;
          usingCachedData: boolean;
        };

        expect(value).toEqual({
          itemId: "inactive-calendar-item",
          loadingFallback: false,
          unavailable: false,
          usingCachedData: true,
        });
      });

    await expectCachedCalendar();
    await act(async () => calendarFailure.resolve());
    await expectCachedCalendar();

    expect(queryClient?.getQueryState(keys.inactiveCalendar)).toMatchObject({
      status: "error",
      data: [{ id: "inactive-calendar-item" }],
    });
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /Cannot update a component .* while rendering a different component/
    );
  });

  it("never advances persisted metadata from restored query successes while degraded", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    const putRecord = vi.spyOn(repository, "putRecord");

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({ phase: "cached", source: "cached-recipe" })
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(putRecord).not.toHaveBeenCalled();
    const scope = await repository.selectLastConfirmedScope(window.location.origin);

    expect(scope ? await repository.listRecords(scope.key) : []).toEqual([
      expect.objectContaining({ dataUpdatedAt: 10, persistedAt: 11 }),
    ]);
  });

  it("does not install fallback for a confirmed auth or validation response", async () => {
    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="domain-error" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "none",
        loading: false,
        unavailable: false,
      })
    );
  });

  it("removes the render scope after a confirmed sign-out", async () => {
    getKeys();
    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).not.toBeNull();
    });

    vi.mocked(fetch).mockResolvedValueOnce(new Response("null", { status: 200 }));
    auth.session = { data: null, error: null, isPending: false };
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toBeNull();
    });

    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    act(() => runtime.reportHttpFailure());
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "unavailable",
        renderUser: null,
        usingCachedData: false,
      })
    );
  });

  it("waits for the new household query before switching a live user scope", async () => {
    getKeys();
    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect((await repository.selectLastConfirmedScope(window.location.origin))?.userId).toBe(
        USER.id
      );
    });

    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness householdData={SECOND_HOUSEHOLD_DATA} mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: SECOND_USER.id,
        householdId: SECOND_HOUSEHOLD_DATA.household.id,
      });
    });
  });

  it("isolates successful reads when the same user moves to another household", async () => {
    const keys = getKeys();
    const firstDashboard = {
      pages: [
        {
          recipes: [{ id: "household-one-recipe", name: "First household" }],
          total: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    const secondDashboard = {
      pages: [
        {
          recipes: [{ id: "household-two-recipe", name: "Second household" }],
          total: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    let dashboardData = firstDashboard;
    let queryClient: QueryClient | null = null;

    function MutableHarness() {
      return (
        <>
          <ReadHarness dashboardData={dashboardData} mode="healthy" runtime={runtime} />
          <QueryClientProbe capture={(value) => (queryClient = value)} />
        </>
      );
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() => expect(state().source).toBe("household-one-recipe"));
    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        householdId: HOUSEHOLD_DATA.household.id,
      });
    });

    dashboardData = secondDashboard;
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );
    act(() => setNetworkQueryData(queryClient, keys.household, SAME_USER_SECOND_HOUSEHOLD_DATA));

    await waitFor(() => expect(state().source).toBe("household-two-recipe"));
    await waitFor(async () => {
      const scope = await repository.selectLastConfirmedScope(window.location.origin);
      const records = scope ? await repository.listRecords(scope.key) : [];

      expect(scope).toMatchObject({
        userId: USER.id,
        householdId: SAME_USER_SECOND_HOUSEHOLD_DATA.household.id,
      });
      expect(records).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            pages: [
              expect.objectContaining({
                recipes: [expect.objectContaining({ id: "household-two-recipe" })],
              }),
            ],
          }),
        }),
      ]);
    });
  });

  it("isolates successful reads when the same user leaves for a personal scope", async () => {
    const keys = getKeys();
    const personalDashboard = {
      pages: [
        {
          recipes: [{ id: "personal-recipe", name: "Personal" }],
          total: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    let dashboardData = LIVE_DASHBOARD;
    let queryClient: QueryClient | null = null;

    function MutableHarness() {
      return (
        <>
          <ReadHarness dashboardData={dashboardData} mode="healthy" runtime={runtime} />
          <QueryClientProbe capture={(value) => (queryClient = value)} />
        </>
      );
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() => expect(state().source).toBe("live-recipe"));
    dashboardData = personalDashboard;
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );
    act(() => setNetworkQueryData(queryClient, keys.household, PERSONAL_HOUSEHOLD_DATA));

    await waitFor(() => expect(state().source).toBe("personal-recipe"));
    await waitFor(async () => {
      const scope = await repository.selectLastConfirmedScope(window.location.origin);
      const records = scope ? await repository.listRecords(scope.key) : [];

      expect(scope).toMatchObject({
        userId: USER.id,
        householdId: `user:${USER.id}`,
      });
      expect(records).toEqual([
        expect.objectContaining({
          data: expect.objectContaining({
            pages: [
              expect.objectContaining({
                recipes: [expect.objectContaining({ id: "personal-recipe" })],
              }),
            ],
          }),
        }),
      ]);
    });
  });

  it("never hydrates a previous user's prepared scope for a confirmed live user", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    auth.getSession.mockResolvedValue({ data: { user: SECOND_USER }, error: null });

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "unavailable",
        source: "none",
        unavailable: true,
        usingCachedData: false,
        renderUser: null,
      })
    );
  });

  it("removes restored user data when the first confirmed live session belongs to another user", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    let mode: QueryMode = "offline";
    let gate: Promise<void> | undefined;
    const liveRequest = deferred();

    function MutableHarness() {
      return (
        <ReadHarness
          gate={gate}
          householdData={SECOND_HOUSEHOLD_DATA}
          mode={mode}
          runtime={runtime}
        />
      );
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "cached",
        source: "cached-recipe",
        renderUser: USER.id,
      })
    );

    mode = "deferred";
    gate = liveRequest.promise;
    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    auth.getSession.mockResolvedValue({ data: { user: SECOND_USER }, error: null });
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );
    act(() => runtime.reportHttpSuccess());

    await waitFor(() =>
      expect(state()).toMatchObject({
        source: "none",
        renderUser: null,
        usingCachedData: false,
        inventoryRecords: 0,
      })
    );

    await act(async () => liveRequest.resolve());
    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: SECOND_USER.id,
        householdId: SECOND_HOUSEHOLD_DATA.household.id,
      });
    });
  });

  it("abandons a fallback restore when the live user changes while records are loading", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const recordsRequest = deferred();
    const liveRequest = deferred();
    const listRecords = repository.listRecords.bind(repository);
    let mode: QueryMode = "offline";
    let gate: Promise<void> | undefined;

    vi.spyOn(repository, "listRecords").mockImplementation(async (scopeKey) => {
      await recordsRequest.promise;

      return listRecords(scopeKey);
    });

    function MutableHarness() {
      return (
        <ReadHarness
          gate={gate}
          householdData={SECOND_HOUSEHOLD_DATA}
          mode={mode}
          runtime={runtime}
        />
      );
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() => expect(state().phase).toBe("loading-fallback"));

    mode = "deferred";
    gate = liveRequest.promise;
    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    auth.getSession.mockResolvedValue({ data: { user: SECOND_USER }, error: null });
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );
    act(() => runtime.reportHttpSuccess());
    await act(async () => recordsRequest.resolve());

    await waitFor(() =>
      expect(state()).toMatchObject({
        source: "none",
        renderUser: null,
        usingCachedData: false,
      })
    );

    await act(async () => liveRequest.resolve());
  });

  it("removes pending persisted reads before a different user can inherit them", async () => {
    const firstRequest = deferred();
    const secondRequest = deferred();
    const firstDashboard = {
      pages: [
        {
          recipes: [{ id: "first-user-recipe", name: "First" }],
          total: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    const secondDashboard = {
      pages: [
        {
          recipes: [{ id: "second-user-recipe", name: "Second" }],
          total: 1,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    };
    let gate = firstRequest.promise;
    let householdData = HOUSEHOLD_DATA;
    let dashboardData = firstDashboard;

    function MutableHarness() {
      return (
        <ReadHarness
          dashboardData={dashboardData}
          gate={gate}
          householdData={householdData}
          mode="deferred"
          runtime={runtime}
        />
      );
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() => expect(state()).toMatchObject({ loading: true, source: "none" }));

    gate = secondRequest.promise;
    householdData = SECOND_HOUSEHOLD_DATA;
    dashboardData = secondDashboard;
    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    auth.getSession.mockResolvedValue({ data: { user: SECOND_USER }, error: null });
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await act(async () => firstRequest.resolve());
    await waitFor(() => expect(state()).toMatchObject({ loading: true, source: "none" }));

    await act(async () => secondRequest.resolve());
    await waitFor(() =>
      expect(state()).toMatchObject({ loading: false, source: "second-user-recipe" })
    );
  });

  it("keeps a late scope confirmation from reactivating a previous user", async () => {
    const firstConfirmation = deferred();
    const confirmScope = repository.confirmScope.bind(repository);

    vi.spyOn(repository, "confirmScope").mockImplementation(async (input) => {
      if (input.userId === USER.id) await firstConfirmation.promise;

      return confirmScope(input);
    });

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(repository.confirmScope).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER.id })
      )
    );

    auth.session = { data: { user: SECOND_USER }, error: null, isPending: false };
    auth.getSession.mockResolvedValue({ data: { user: SECOND_USER }, error: null });
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness householdData={SECOND_HOUSEHOLD_DATA} mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: SECOND_USER.id,
      });
    });

    await act(async () => firstConfirmation.resolve());
    await waitFor(async () => {
      const firstScope = await repository.getCompatibleScope({
        backendOrigin: window.location.origin,
        userId: USER.id,
        householdId: HOUSEHOLD_DATA.household.id,
      });

      expect(firstScope).toMatchObject({ active: false });
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: SECOND_USER.id,
      });
    });
  });

  it("keeps a late confirmation from reactivating the same user's previous household", async () => {
    const keys = getKeys();
    const firstConfirmation = deferred();
    const confirmScope = repository.confirmScope.bind(repository);
    let queryClient: QueryClient | null = null;

    vi.spyOn(repository, "confirmScope").mockImplementation(async (input) => {
      if (input.householdId === HOUSEHOLD_DATA.household.id) {
        await firstConfirmation.promise;
      }

      return confirmScope(input);
    });

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
        <QueryClientProbe capture={(value) => (queryClient = value)} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(repository.confirmScope).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: HOUSEHOLD_DATA.household.id })
      )
    );
    act(() => setNetworkQueryData(queryClient, keys.household, SAME_USER_SECOND_HOUSEHOLD_DATA));

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: USER.id,
        householdId: SAME_USER_SECOND_HOUSEHOLD_DATA.household.id,
      });
    });

    await act(async () => firstConfirmation.resolve());
    await waitFor(async () => {
      const firstScope = await repository.getCompatibleScope({
        backendOrigin: window.location.origin,
        userId: USER.id,
        householdId: HOUSEHOLD_DATA.household.id,
      });

      expect(firstScope).toMatchObject({ active: false });
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: USER.id,
        householdId: SAME_USER_SECOND_HOUSEHOLD_DATA.household.id,
      });
    });
  });

  it("keeps confirmed sign-out durable when IndexedDB cleanup fails", async () => {
    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).not.toBeNull();
    });

    vi.spyOn(repository, "clearConfirmedRenderScope").mockRejectedValue(
      new Error("IndexedDB write failed")
    );
    vi.mocked(fetch).mockResolvedValueOnce(new Response("null", { status: 200 }));
    auth.session = { data: null, error: null, isPending: false };
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() => expect(state()).toMatchObject({ renderUser: null, inventoryRecords: 0 }));
    expect(await repository.selectLastConfirmedScope(window.location.origin)).not.toBeNull();
    rendered.unmount();

    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    auth.getSession.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    runtime = new WebConnectivityRuntime("test-relaunch", window.localStorage);

    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="offline" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "unavailable",
        source: "none",
        renderUser: null,
        usingCachedData: false,
      })
    );
  });

  it("keeps cached data visible while replay reconciliation converges it to live", async () => {
    const keys = getKeys();

    await seedCache(repository, keys, true);
    runtime.reportHttpFailure();
    auth.session = { data: null, error: null, isPending: false };
    let mode: QueryMode = "offline";
    let recoveryGate: Promise<void> | undefined;
    let dashboardReads = 0;

    function MutableHarness() {
      return (
        <ReadHarness
          gate={recoveryGate}
          mode={mode}
          onDashboardRead={() => dashboardReads++}
          runtime={runtime}
        />
      );
    }

    const rendered = render(
      <StrictMode>
        <ProviderTree repository={repository} runtime={runtime}>
          <MutableHarness />
        </ProviderTree>
      </StrictMode>
    );

    await waitFor(() => expect(state().source).toBe("cached-recipe"));
    dashboardReads = 0;
    const liveRequest = deferred();

    mode = "deferred";
    recoveryGate = liveRequest.promise;
    rendered.rerender(
      <StrictMode>
        <ProviderTree repository={repository} runtime={runtime}>
          <MutableHarness />
        </ProviderTree>
      </StrictMode>
    );
    auth.getSession.mockResolvedValue({ data: { user: USER }, error: null });

    await act(async () => {
      await runtime.recover();
    });

    await waitFor(
      () =>
        expect(state()).toMatchObject({
          source: "cached-recipe",
          loading: false,
          usingCachedData: true,
        }),
      { timeout: 2_000 }
    );

    await act(async () => liveRequest.resolve());
    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        usingCachedData: false,
      })
    );
    expect(dashboardReads).toBe(1);
  });

  it("moves an already-live screen to last-good fallback when HTTP becomes degraded", async () => {
    const keys = getKeys();

    await seedCache(repository, keys);
    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        usingCachedData: false,
      })
    );

    act(() => runtime.reportHttpFailure());

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        unavailable: false,
        usingCachedData: false,
      })
    );
  });

  it("keeps an already-live query available while restoring other inactive cached queries", async () => {
    const keys = getKeys();

    await seedCache(repository, keys, true);
    render(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        unavailable: false,
      })
    );

    act(() => runtime.reportHttpFailure());

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "cached",
        source: "live-recipe",
        unavailable: false,
        usingCachedData: false,
        cachedUpdatedAt: null,
      })
    );
  });
});
