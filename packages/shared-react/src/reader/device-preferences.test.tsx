import type { TRPCLink } from "@trpc/client";
import type { ReactNode } from "react";
import { dehydrate, hydrate, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { createTRPCClient, TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  DeviceKind,
  DevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import type { AppRouter } from "@norish/trpc/client";
import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { DevicePreferencesForVisit, useDevicePreference } from "@norish/shared-react/reader";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

type Blocks = Record<DeviceKind, DevicePreferences>;
type Stored = Partial<Record<DeviceKind, Partial<DevicePreferences>>>;
type Write = { kind: DeviceKind; preferences: Partial<DevicePreferences> };

const current = vi.hoisted(() => ({ trpc: null as unknown }));

vi.mock("../trpc", () => ({ useTRPC: () => current.trpc }));

const AN_HOUR_AGO = Date.now() - 60 * 60_000;
const TWO_HOURS_AGO = Date.now() - 2 * 60 * 60_000;

function blocks(stored: Stored = {}): Blocks {
  return {
    phone: { ...DEVICE_PREFERENCE_DEFAULTS, ...stored.phone },
    desktop: { ...DEVICE_PREFERENCE_DEFAULTS, ...stored.desktop },
  };
}

/** The server: its stored blocks, the reads it answered and the writes it was sent. */
let server: { blocks: Blocks; read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
let queryClient: QueryClient;
let trpc: ReturnType<typeof createTRPCOptionsProxy<AppRouter>>;

function answer(path: string, input: unknown): Promise<unknown> {
  if (path === "user.getDevicePreferences") return Promise.resolve(server.read());
  if (path === "user.setDevicePreferences") return Promise.resolve(server.write(input));

  return Promise.reject(new Error(`unexpected ${path}`));
}

const link: TRPCLink<AppRouter> =
  () =>
  ({ op }) =>
    observable((observer) => {
      answer(op.path, op.input).then(
        (data) => {
          observer.next({ result: { type: "data", data } });
          observer.complete();
        },
        (error: unknown) => observer.error(error as TRPCClientError<AppRouter>)
      );
    });

/** The query's data as a server pass or the Offline Cache hands it over, saved at `at`. */
function copyOf(stored: Stored, at = Date.now()) {
  const source = new QueryClient();

  source.setQueryData(trpc.user.getDevicePreferences.queryKey(), blocks(stored), {
    updatedAt: at,
  });

  return dehydrate(source);
}

function cached(): Blocks | undefined {
  return queryClient.getQueryData(trpc.user.getDevicePreferences.queryKey());
}

let setView!: ReturnType<typeof useDevicePreference<"groceryViewMode">>[1];
let setGrouped!: ReturnType<typeof useDevicePreference<"groceryGroupSimilar">>[1];
const renders = { amount: 0 };

function Probe() {
  const [view, viewSetter] = useDevicePreference("groceryViewMode");
  const [grouped, groupedSetter] = useDevicePreference("groceryGroupSimilar");

  setView = viewSetter;
  setGrouped = groupedSetter;

  return <span data-testid="state">{`${view}:${grouped}`}</span>;
}

function AmountProbe() {
  const [amount] = useDevicePreference("amountDisplay");

  renders.amount += 1;

  return <span data-testid="amount">{amount}</span>;
}

function renderProbe({
  kind = "phone",
  children,
}: { kind?: DeviceKind; children?: ReactNode } = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformProvider adapter={fakePlatformAdapter(kind)}>
        {children ?? <Probe />}
      </PlatformProvider>
    </QueryClientProvider>
  );
}

const shown = () => screen.getByTestId("state").textContent;

/** Lets TanStack deliver what it scheduled; its notifications wait for the next task. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/** The next write reaches the server when the test lets it land. */
function holdWrite() {
  const store = server.write.getMockImplementation()!;
  let land!: () => void;

  server.write.mockImplementationOnce(
    (write: Write) => new Promise((resolve) => (land = () => resolve(store(write))))
  );

  return () => act(async () => land());
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { networkMode: "always", retry: 0 } },
  });
  trpc = createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({ links: [link] }),
    queryClient,
  });
  current.trpc = trpc;
  server = {
    blocks: blocks(),
    read: vi.fn(() => server.blocks),
    write: vi.fn(({ kind, preferences }: Write) => {
      server.blocks = { ...server.blocks, [kind]: { ...server.blocks[kind], ...preferences } };

      return { success: true };
    }),
  };
  renders.amount = 0;
});

describe("useDevicePreference", () => {
  it("draws the seeded choices from the first frame", () => {
    hydrate(queryClient, copyOf({ phone: { groceryViewMode: "recipe" } }));
    renderProbe();

    expect(shown()).toBe("recipe:true");
    expect(server.read).not.toHaveBeenCalled();
  });

  it("applies a change at once, lands it on the query and writes it for this kind", async () => {
    const land = holdWrite();

    hydrate(queryClient, copyOf({ phone: { groceryViewMode: "recipe" } }));
    renderProbe({ kind: "desktop" });

    act(() => setView("recipe"));
    await settle();

    // Shown and cached before the write returns.
    expect(shown()).toBe("recipe:true");
    expect(cached()).toEqual(
      blocks({ phone: { groceryViewMode: "recipe" }, desktop: { groceryViewMode: "recipe" } })
    );
    expect(server.write).toHaveBeenCalledWith({
      kind: "desktop",
      preferences: { groceryViewMode: "recipe" },
    });
    await land();
  });

  it("takes an updater over the current choice", async () => {
    hydrate(queryClient, copyOf({}));
    renderProbe();

    act(() => setGrouped((grouped) => !grouped));

    await waitFor(() => expect(shown()).toBe("store:false"));
    expect(server.write).toHaveBeenCalledWith({
      kind: "phone",
      preferences: { groceryGroupSimilar: false },
    });
  });

  it("keeps the server's choice over an older copy restored after it", async () => {
    hydrate(queryClient, copyOf({ phone: { groceryViewMode: "recipe" } }));
    renderProbe();

    // Another browser of the same kind changed it since this one last saved its copy.
    act(() => hydrate(queryClient, copyOf({ phone: { groceryViewMode: "store" } }, AN_HOUR_AGO)));
    await settle();

    expect(shown()).toBe("recipe:true");
  });

  it("Offline, settles on the saved copy over a page the service worker saved earlier", async () => {
    hydrate(queryClient, copyOf({}, TWO_HOURS_AGO));
    renderProbe();

    act(() => hydrate(queryClient, copyOf({ phone: { groceryViewMode: "recipe" } }, AN_HOUR_AGO)));

    await waitFor(() => expect(shown()).toBe("recipe:true"));
  });

  it("settles on a read after the change, even for a choice changed here", async () => {
    hydrate(queryClient, copyOf({}));
    renderProbe();
    act(() => setGrouped(false));
    await waitFor(() => expect(server.read).toHaveBeenCalled());

    // A later read brings a change made since on another screen of this kind.
    server.blocks = blocks({ phone: { groceryViewMode: "recipe", groceryGroupSimilar: true } });
    await act(() => queryClient.refetchQueries());

    await waitFor(() => expect(shown()).toBe("recipe:true"));
  });

  it("keeps a change whose write is still on its way over a read that lands first", async () => {
    const land = holdWrite();

    hydrate(queryClient, copyOf({}));
    renderProbe();
    act(() => setView("recipe"));
    await settle();

    // A background read (the Cache Warmer's) answers with the server's copy from
    // before the change, plus a change made since on another screen of this kind.
    server.blocks = blocks({ phone: { groceryGroupSimilar: false } });
    await act(() => queryClient.refetchQueries());
    await settle();

    expect(shown()).toBe("recipe:false");

    // No flash of that read between the write landing and the read after it.
    let answer!: () => void;

    server.read.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(server.blocks)))
    );
    await land();
    await waitFor(() => expect(server.read).toHaveBeenCalledTimes(2));
    expect(shown()).toBe("recipe:false");
    await act(async () => answer());
    await settle();
    expect(shown()).toBe("recipe:false");
  });

  it("writes one at a time, in the order they were made", async () => {
    const land = holdWrite();

    hydrate(queryClient, copyOf({}));
    renderProbe();
    act(() => setView("recipe"));
    act(() => setGrouped(false));
    await settle();

    expect(shown()).toBe("recipe:false");
    expect(server.write).toHaveBeenCalledTimes(1);
    await land();
    await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
    expect(server.write.mock.calls.map(([write]) => write)).toEqual([
      { kind: "phone", preferences: { groceryViewMode: "recipe" } },
      { kind: "phone", preferences: { groceryGroupSimilar: false } },
    ]);
    // Read once, after the last write.
    await waitFor(() => expect(server.read).toHaveBeenCalledTimes(1));
    expect(shown()).toBe("recipe:false");
  });

  it("puts the stored choice back when the server refuses a change", async () => {
    let refuse!: () => void;

    server.write.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        refuse = () =>
          reject(
            TRPCClientError.from({
              error: {
                code: -32600,
                message: "refused",
                data: { code: "BAD_REQUEST", httpStatus: 400 },
              },
            })
          );
      })
    );
    hydrate(queryClient, copyOf({}));
    renderProbe();

    act(() => setView("recipe"));
    await settle();

    expect(shown()).toBe("recipe:true");
    await act(async () => refuse());
    await waitFor(() => expect(shown()).toBe("store:true"));
  });

  it("keeps a change the Outbox queued while Offline", async () => {
    server.write.mockRejectedValueOnce(TRPCClientError.from(new TypeError("Failed to fetch")));
    hydrate(queryClient, copyOf({}));
    renderProbe();

    act(() => setView("recipe"));
    await waitFor(() => expect(server.write).toHaveBeenCalled());
    await settle();

    expect(shown()).toBe("recipe:true");
    expect(cached()?.phone.groceryViewMode).toBe("recipe");
    expect(server.read).not.toHaveBeenCalled();
  });

  it("keeps a copy restored from the Offline Cache while a read was on its way", () => {
    // A read that started before the offline copy was restored...
    void queryClient.fetchQuery({
      queryKey: trpc.user.getDevicePreferences.queryKey(),
      queryFn: () => new Promise<Blocks>(() => {}),
    });
    // ...and the copy put back the way a restore does it, not by hand.
    hydrate(queryClient, copyOf({ phone: { groceryGroupSimilar: false } }, AN_HOUR_AGO));
    renderProbe();

    act(() => setView("recipe"));

    expect(cached()?.phone).toMatchObject({
      groceryViewMode: "recipe",
      groceryGroupSimilar: false,
    });
  });

  it("starts with no server pass from this kind's block in the restored copy", () => {
    hydrate(
      queryClient,
      copyOf(
        {
          phone: { groceryViewMode: "recipe", groceryGroupSimilar: false },
          desktop: { groceryViewMode: "store" },
        },
        AN_HOUR_AGO
      )
    );
    renderProbe();

    expect(shown()).toBe("recipe:false");
  });

  it("never shows one kind's choices on the other", async () => {
    server.blocks = blocks({
      phone: { groceryViewMode: "recipe" },
      desktop: { groceryGroupSimilar: false },
    });
    renderProbe({ kind: "desktop" });

    await waitFor(() => expect(shown()).toBe("store:false"));
  });

  it("re-renders only the readers of the preference that changed", async () => {
    hydrate(queryClient, copyOf({}));
    renderProbe({
      children: (
        <>
          <Probe />
          <AmountProbe />
        </>
      ),
    });
    const before = renders.amount;

    act(() => setView("recipe"));
    await waitFor(() => expect(server.read).toHaveBeenCalled());
    await settle();

    expect(shown()).toBe("recipe:true");
    expect(renders.amount).toBe(before);
  });

  it("on a shared recipe, keeps a change for the visit without reading or writing", async () => {
    hydrate(queryClient, copyOf({}));
    renderProbe({
      children: (
        <DevicePreferencesForVisit>
          <Probe />
        </DevicePreferencesForVisit>
      ),
    });

    act(() => setView("recipe"));
    await settle();

    expect(shown()).toBe("recipe:true");
    expect(server.write).not.toHaveBeenCalled();
    expect(server.read).not.toHaveBeenCalled();
  });

  it("signed out on a shared recipe, starts from the defaults without reading", () => {
    renderProbe({
      children: (
        <DevicePreferencesForVisit>
          <Probe />
        </DevicePreferencesForVisit>
      ),
    });

    expect(shown()).toBe("store:true");
    expect(server.read).not.toHaveBeenCalled();
  });
});
