import type { DevicePreferencesSeed } from "@/lib/request-profile";
import type { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import {
  DevicePreferencesProvider,
  useDeviceKind,
  useDevicePreference,
} from "@/context/device-preferences-context";

import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

import { createTestQueryClient, createTestWrapper } from "../hooks/user/test-utils";

const userQueryKey = [["user", "get"], { type: "query" }] as const;
const write = vi.hoisted(() => vi.fn());

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    user: {
      get: {
        queryKey: () => userQueryKey,
        queryOptions: () => ({ queryKey: userQueryKey, queryFn: async () => null }),
      },
      setDevicePreferences: { mutationOptions: () => ({ mutationFn: write }) },
    },
  }),
}));

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

let queryClient: QueryClient;
let setView!: ReturnType<typeof useDevicePreference<"groceryViewMode">>[1];

function Probe() {
  const [view, setter] = useDevicePreference("groceryViewMode");
  const [grouped] = useDevicePreference("groceryGroupSimilar");

  setView = setter;

  return <span data-testid="state">{`${useDeviceKind()}:${view}:${grouped}`}</span>;
}

function seed(overrides: Partial<DevicePreferencesSeed> = {}): DevicePreferencesSeed {
  return {
    kind: "phone",
    values: DEVICE_PREFERENCE_DEFAULTS,
    signedIn: true,
    readAt: Date.now(),
    ...overrides,
  };
}

function storeProfile(preferences: object, updatedAt?: number) {
  queryClient.setQueryData(
    userQueryKey,
    { user: { id: "user-1", version: 1, preferences }, apiKeys: [] },
    updatedAt === undefined ? undefined : { updatedAt }
  );
}

function renderProvider(providerSeed?: DevicePreferencesSeed) {
  const Wrapper = createTestWrapper(queryClient);

  return render(
    <Wrapper>
      <DevicePreferencesProvider seed={providerSeed}>
        <Probe />
      </DevicePreferencesProvider>
    </Wrapper>
  );
}

beforeEach(() => {
  queryClient = createTestQueryClient();
  write.mockReset().mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DevicePreferencesProvider", () => {
  it("draws the seeded choices from the first frame", () => {
    renderProvider(seed({ values: { ...DEVICE_PREFERENCE_DEFAULTS, groceryViewMode: "recipe" } }));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
  });

  it("applies a change at once, puts it on the profile query and writes it for this kind", async () => {
    storeProfile({ locale: "nl" }, Date.now() - 60_000);
    renderProvider(seed({ kind: "desktop" }));

    act(() => setView("recipe"));

    expect(screen.getByTestId("state")).toHaveTextContent("desktop:recipe:true");
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        { kind: "desktop", preferences: { groceryViewMode: "recipe" } },
        expect.anything()
      )
    );
    expect(
      queryClient.getQueryData<{ user: { preferences: object } }>(userQueryKey)?.user.preferences
    ).toEqual({
      locale: "nl",
      desktop: { ...DEVICE_PREFERENCE_DEFAULTS, groceryViewMode: "recipe" },
    });
  });

  it("settles on a profile fresher than the page it was served with", () => {
    // HTML the service worker cached before the last change.
    storeProfile({ phone: { groceryViewMode: "recipe" } }, Date.now());
    renderProvider(seed({ readAt: Date.now() - 60 * 60_000 }));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
  });

  it("keeps the server's choice over an older copy of the profile", () => {
    // Another browser of the same kind changed it since this one last looked.
    storeProfile({ phone: { groceryViewMode: "store" } }, Date.now() - 60 * 60_000);
    renderProvider(seed({ values: { ...DEVICE_PREFERENCE_DEFAULTS, groceryViewMode: "recipe" } }));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
  });

  it("starts with no server pass from this kind's block in the profile query", () => {
    vi.stubGlobal("navigator", { userAgent: IPHONE });
    storeProfile({
      phone: { groceryViewMode: "recipe", groceryGroupSimilar: false },
      desktop: { groceryViewMode: "store" },
    });
    renderProvider();

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:false");
  });

  it("never shows one kind's choices on the other", () => {
    storeProfile({ phone: { groceryViewMode: "recipe" } }, Date.now());
    renderProvider(seed({ kind: "desktop", readAt: Date.now() - 60_000 }));

    expect(screen.getByTestId("state")).toHaveTextContent("desktop:store:true");
  });

  it("lets a signed-out reader switch for the visit without writing anything", () => {
    renderProvider(seed({ signedIn: false }));

    act(() => setView("recipe"));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
    expect(write).not.toHaveBeenCalled();
  });
});
