import type { QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { TRPCProviderWrapper, useTRPC } from "@/app/providers/trpc-provider";
import { OfflineWebProvider, useOfflineWeb } from "@/context/offline-web-context";
import { WebConnectivityRuntime } from "@/lib/connectivity";
import { WebReadCacheRepository } from "@/lib/offline-read-cache";
import { createOfflineReadCacheRegistry } from "@/lib/offline-read-cache/query-registry";
import { useQuery } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
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
  inactiveDetail: QueryKey;
  household: QueryKey;
};

const USER = {
  id: "user-1",
  email: "user@example.com",
  name: "Offline User",
  image: null,
};
const HOUSEHOLD_DATA = {
  household: { id: "household-1", name: "Home" },
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
    inactiveDetail: trpc.recipes.get.queryKey({ id: "inactive-recipe" }),
    household: registry.householdQueryKey,
  });

  return null;
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
}: {
  mode: QueryMode;
  runtime: WebConnectivityRuntime;
  gate?: Promise<void>;
  householdData?: typeof HOUSEHOLD_DATA;
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
    queryFn: () => read(LIVE_DASHBOARD),
    retry: false,
  });

  return (
    <output data-testid="offline-state">
      {JSON.stringify({
        phase: offline.phase,
        source: dashboard.data?.pages[0]?.recipes[0]?.id ?? "none",
        loading: dashboard.isPending,
        unavailable: offline.isQueryUnavailable(registry.dashboardQueryKey),
        usingCachedData: offline.usingCachedData,
        renderUser: offline.renderUser?.id ?? null,
      })}
    </output>
  );
}

type HarnessState = {
  phase: string;
  source: string;
  loading: boolean;
  unavailable: boolean;
  usingCachedData: boolean;
  renderUser: string | null;
};

function state(): HarnessState {
  return JSON.parse(screen.getByTestId("offline-state").textContent ?? "{}") as HarnessState;
}

async function seedCache(
  repository: WebReadCacheRepository,
  keys: Keys,
  includeInactiveDetail = false
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

  if (includeInactiveDetail) {
    await repository.putRecord({
      scopeKey: scope.key,
      kind: "recipe-detail",
      queryKey: keys.inactiveDetail,
      data: { id: "inactive-recipe", name: "Inactive cached detail" },
      dataUpdatedAt: 10,
      counts: { recipeDetails: 1 },
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
    window.localStorage.clear();
  });

  afterEach(() => {
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
        renderUser: USER.id,
      })
    );

    await act(async () => request.resolve());
    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        usingCachedData: false,
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

    auth.session = { data: null, error: null, isPending: false };
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toBeNull();
    });
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

    const secondUser = {
      id: "user-2",
      email: "second@example.com",
      name: "Second User",
      image: null,
    };
    const secondHousehold = {
      household: { id: "household-2", name: "Other home" },
      currentUserId: secondUser.id,
    };

    auth.session = { data: { user: secondUser }, error: null, isPending: false };
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <ReadHarness householdData={secondHousehold} mode="healthy" runtime={runtime} />
      </ProviderTree>
    );

    await waitFor(async () => {
      expect(await repository.selectLastConfirmedScope(window.location.origin)).toMatchObject({
        userId: secondUser.id,
        householdId: secondHousehold.household.id,
      });
    });
  });

  it("runs recovery through the replay signal before converging cached data to live", async () => {
    const keys = getKeys();

    await seedCache(repository, keys, true);
    auth.session = { data: null, error: new TypeError("Failed to fetch"), isPending: false };
    let mode: QueryMode = "offline";

    function MutableHarness() {
      return <ReadHarness mode={mode} runtime={runtime} />;
    }

    const rendered = render(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );

    await waitFor(() => expect(state().source).toBe("cached-recipe"));
    mode = "healthy";
    rendered.rerender(
      <ProviderTree repository={repository} runtime={runtime}>
        <MutableHarness />
      </ProviderTree>
    );
    auth.getSession.mockResolvedValue({ data: { user: USER }, error: null });

    await act(async () => {
      await runtime.recover();
    });

    await waitFor(() =>
      expect(state()).toMatchObject({
        phase: "live",
        source: "live-recipe",
        usingCachedData: false,
      })
    );
  });
});
