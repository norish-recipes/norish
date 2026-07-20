import { WebRecoveryCoordinator } from "@/lib/connectivity/recovery";
import {
  readBackendUnavailableSimulation,
  WEB_BACKEND_SIMULATION_STORAGE_KEY,
  WebConnectivityRuntime,
} from "@/lib/connectivity/runtime";
import { checkWebBackendReachability, createWebTransportFetch } from "@/lib/connectivity/transport";
import { QueryClient } from "@tanstack/react-query";

describe("WebConnectivityRuntime", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts checking and classifies browser and HTTP outcomes with monotonic timestamps", () => {
    const runtime = new WebConnectivityRuntime("development", window.localStorage);

    vi.spyOn(Date, "now").mockReturnValue(100);
    expect(runtime.getSnapshot().state).toBe("checking");

    runtime.reportHttpFailure();
    const firstFailure = runtime.getSnapshot();

    expect(firstFailure.state).toBe("backend-unreachable");
    runtime.reportHttpSuccess();
    expect(runtime.getSnapshot()).toMatchObject({
      state: "online",
      lastFailureAt: firstFailure.lastFailureAt,
      lastSuccessAt: 101,
      lastOutcomeAt: 101,
    });

    runtime.reportBrowserOffline();
    expect(runtime.getSnapshot()).toMatchObject({
      state: "offline",
      lastOutcomeAt: 102,
      transportFailureConfirmed: false,
    });
    runtime.reportHttpFailure();
    expect(runtime.getSnapshot()).toMatchObject({
      state: "backend-unreachable",
      transportFailureConfirmed: true,
    });
  });

  it("runs only one recovery check and emits recovery after a real success", async () => {
    const recovery = new WebRecoveryCoordinator();
    const runtime = new WebConnectivityRuntime("development", window.localStorage, recovery);
    let resolveCheck: ((value: boolean) => void) | null = null;
    const check = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveCheck = resolve;
        })
    );
    const recovered = vi.fn();
    const stop = runtime.start(check);

    const unsubscribe = recovery.subscribeToSucceeded(recovered);
    const first = runtime.recover();
    const second = runtime.recover();

    expect(check).toHaveBeenCalledOnce();
    resolveCheck?.(true);

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(runtime.getSnapshot()).toMatchObject({ state: "online", recoveryInProgress: false });
    expect(recovered).toHaveBeenCalledOnce();

    stop();
    unsubscribe();
  });

  it("classifies an initially offline browser without confirming a transport failure", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const stop = runtime.start(vi.fn().mockResolvedValue(false));

    expect(runtime.getSnapshot()).toMatchObject({
      state: "offline",
      transportFailureConfirmed: false,
    });

    stop();
    onLine.mockRestore();
  });

  it("persists development simulation but ignores it in production", async () => {
    const recovery = vi.fn().mockResolvedValue(true);
    const runtime = new WebConnectivityRuntime("development", window.localStorage);

    runtime.start(recovery);
    await expect(runtime.setSimulatedBackendUnavailable(true)).resolves.toBe(true);
    expect(window.localStorage.getItem(WEB_BACKEND_SIMULATION_STORAGE_KEY)).toBe("true");
    expect(runtime.getSnapshot().state).toBe("backend-unreachable");

    await expect(runtime.setSimulatedBackendUnavailable(false)).resolves.toBe(true);
    expect(recovery).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem(WEB_BACKEND_SIMULATION_STORAGE_KEY)).toBeNull();
    expect(runtime.getSnapshot().state).toBe("online");

    window.localStorage.setItem(WEB_BACKEND_SIMULATION_STORAGE_KEY, "true");
    expect(readBackendUnavailableSimulation(window.localStorage, "production")).toBe(false);
    const production = new WebConnectivityRuntime("production", window.localStorage);

    expect(production.getSnapshot().simulatedBackendUnavailable).toBe(false);
    await expect(production.setSimulatedBackendUnavailable(true)).resolves.toBe(false);
    expect(production.getSnapshot().simulatedBackendUnavailable).toBe(false);
  });

  it("disables simulation even when the subsequent live recovery check fails", async () => {
    const runtime = new WebConnectivityRuntime("development", window.localStorage);

    runtime.start(vi.fn().mockResolvedValue(false));
    await runtime.setSimulatedBackendUnavailable(true);

    await expect(runtime.setSimulatedBackendUnavailable(false)).resolves.toBe(false);
    expect(runtime.getSnapshot()).toMatchObject({
      state: "backend-unreachable",
      simulatedBackendUnavailable: false,
    });
    expect(window.localStorage.getItem(WEB_BACKEND_SIMULATION_STORAGE_KEY)).toBeNull();
  });

  it("uses an uncached live auth request for explicit backend recovery", async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(checkWebBackendReachability(transport)).resolves.toBe(true);
    expect(transport).toHaveBeenNthCalledWith(1, "/api/auth/get-session?disableCookieCache=true", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    await expect(checkWebBackendReachability(transport)).resolves.toBe(false);
    await expect(checkWebBackendReachability(transport)).resolves.toBe(false);
  });

  it("observes success, gateway failure, transport failure, and simulated failure at fetch", async () => {
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const observedFetch = createWebTransportFetch(runtime, transport);

    await expect(observedFetch("/session")).resolves.toMatchObject({ status: 401 });
    expect(runtime.getSnapshot().state).toBe("online");
    await expect(observedFetch("/api/trpc")).resolves.toMatchObject({ status: 503 });
    expect(runtime.getSnapshot().state).toBe("backend-unreachable");
    await expect(observedFetch("/api/trpc")).rejects.toThrow("Failed to fetch");

    await runtime.setSimulatedBackendUnavailable(true);
    await expect(observedFetch("/api/trpc")).rejects.toThrow("simulated backend unavailable");
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it("does not classify an intentionally aborted request as a backend outage", async () => {
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const aborted = new DOMException("The operation was aborted", "AbortError");
    const observedFetch = createWebTransportFetch(
      runtime,
      vi.fn<typeof fetch>().mockRejectedValue(aborted)
    );

    runtime.reportHttpSuccess();

    await expect(observedFetch("/api/trpc")).rejects.toBe(aborted);
    expect(runtime.getSnapshot().state).toBe("online");
  });

  it("keeps query reads paused while degraded without pausing QueryClient mutations", async () => {
    const runtime = new WebConnectivityRuntime("development", window.localStorage);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failureCount) => !runtime.isDegraded() && failureCount < 1,
          refetchOnWindowFocus: () => !runtime.isDegraded(),
        },
      },
    });
    const queryOptions = queryClient.getDefaultOptions().queries!;

    expect((queryOptions.retry as (count: number) => boolean)(0)).toBe(true);
    runtime.reportHttpFailure();
    expect((queryOptions.retry as (count: number) => boolean)(0)).toBe(false);
    expect((queryOptions.refetchOnWindowFocus as () => boolean)()).toBe(false);
    expect(queryClient.getDefaultOptions().mutations?.networkMode).toBeUndefined();
  });
});
