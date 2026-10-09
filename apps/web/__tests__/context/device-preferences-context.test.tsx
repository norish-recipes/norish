import type { DevicePreferencesSeed } from "@/context/device-preferences-context";
import type { QueryClient } from "@tanstack/react-query";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useDeviceKind, useDevicePreference } from "@/context/device-preferences-context";

import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";
import { UserPreferencesSchema } from "@norish/shared/contracts/zod/user";

import {
  renderWithDevicePreferences,
  userQueryKey,
  deviceWrite as write,
} from "../helpers/device-preferences";
import { createTestQueryClient } from "../hooks/user/test-utils";

vi.mock("@/app/providers/trpc-provider", () => import("../helpers/device-preferences-trpc"));

const connectivity = vi.hoisted(() => ({ isOffline: false }));

vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => connectivity,
}));

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const AN_HOUR_AGO = Date.now() - 60 * 60_000;

let queryClient: QueryClient;
let setView!: ReturnType<typeof useDevicePreference<"groceryViewMode">>[1];
let setGrouped!: ReturnType<typeof useDevicePreference<"groceryGroupSimilar">>[1];

function Probe() {
  const [view, viewSetter] = useDevicePreference("groceryViewMode");
  const [grouped, groupedSetter] = useDevicePreference("groceryGroupSimilar");

  setView = viewSetter;
  setGrouped = groupedSetter;

  return <span data-testid="state">{`${useDeviceKind()}:${view}:${grouped}`}</span>;
}

function seed(overrides: Partial<DevicePreferencesSeed> = {}): DevicePreferencesSeed {
  return { kind: "phone", values: DEVICE_PREFERENCE_DEFAULTS, signedIn: true, ...overrides };
}

/** The profile query's answer as the server parses it, saved earlier (`updatedAt`) or read just now. */
function storeProfile(stored: object, updatedAt?: number) {
  const preferences = UserPreferencesSchema.parse(stored);

  queryClient.setQueryData(
    userQueryKey,
    { user: { id: "user-1", version: 1, preferences }, apiKeys: [] },
    updatedAt === undefined ? undefined : { updatedAt }
  );
}

function renderProvider(providerSeed?: DevicePreferencesSeed) {
  return renderWithDevicePreferences(<Probe />, { seed: providerSeed ?? null, queryClient });
}

beforeEach(() => {
  queryClient = createTestQueryClient();
  connectivity.isOffline = false;
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
    storeProfile({ locale: "nl" }, AN_HOUR_AGO);
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

  it("keeps the server's choice over an older saved copy of the profile", () => {
    // Another browser of the same kind changed it since this one last looked.
    storeProfile({ phone: { groceryViewMode: "store" } }, AN_HOUR_AGO);
    renderProvider(seed({ values: { ...DEVICE_PREFERENCE_DEFAULTS, groceryViewMode: "recipe" } }));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
  });

  it("settles on the profile read after the page loaded, even for a choice changed here", async () => {
    renderProvider(seed());
    act(() => setGrouped(false));

    // A refetch brings a change made since on another screen of this kind.
    act(() => storeProfile({ phone: { groceryViewMode: "recipe", groceryGroupSimilar: true } }));

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true"));
  });

  it("Offline, settles on the saved profile over a page the service worker saved earlier", () => {
    connectivity.isOffline = true;
    storeProfile({ phone: { groceryViewMode: "recipe" } }, AN_HOUR_AGO);
    renderProvider(seed());

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
  });

  it("keeps a profile restored from the offline copy while a read was on its way", () => {
    connectivity.isOffline = true;
    // A read that started before the offline copy was restored...
    void queryClient.fetchQuery({ queryKey: userQueryKey, queryFn: () => new Promise(() => {}) });
    // ...and the copy put back the way a restore does it, not by hand.
    const saved = createTestQueryClient();

    saved.setQueryData(userQueryKey, {
      user: { id: "user-1", version: 1, preferences: UserPreferencesSchema.parse({}) },
      apiKeys: [],
    });
    hydrate(queryClient, dehydrate(saved));
    renderProvider(seed());

    act(() => setView("recipe"));

    expect(
      queryClient.getQueryData<{ user: { preferences: { phone?: object } } }>(userQueryKey)?.user
        .preferences.phone
    ).toMatchObject({ groceryViewMode: "recipe" });
  });

  it("starts with no server pass from this kind's block in the profile query", () => {
    vi.stubGlobal("navigator", { userAgent: IPHONE });
    storeProfile(
      {
        phone: { groceryViewMode: "recipe", groceryGroupSimilar: false },
        desktop: { groceryViewMode: "store" },
      },
      AN_HOUR_AGO
    );
    renderProvider();

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:false");
  });

  it("never shows one kind's choices on the other", async () => {
    renderProvider(seed({ kind: "desktop" }));
    act(() =>
      storeProfile({
        phone: { groceryViewMode: "recipe" },
        desktop: { groceryGroupSimilar: false },
      })
    );

    // The desktop's own block arrives; the phone's view never does.
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("desktop:store:false")
    );
  });

  it("lets a signed-out reader switch for the visit without writing anything", () => {
    renderProvider(seed({ signedIn: false }));

    act(() => setView("recipe"));

    expect(screen.getByTestId("state")).toHaveTextContent("phone:recipe:true");
    expect(write).not.toHaveBeenCalled();
  });
});
