import type { ConnectivityPosture } from "@/app/providers/connectivity-provider";
import { OfflineUnavailable } from "@/app/~offline/offline-unavailable";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectivity = { posture: "offline" as ConnectivityPosture };

vi.mock("@/app/providers/connectivity-provider", () => ({
  useConnectivity: () => ({
    posture: connectivity.posture,
    isLive: connectivity.posture === "live",
    isOffline: connectivity.posture !== "live",
    isForced: connectivity.posture === "offline-forced",
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const reload = vi.fn();

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/recipes/some-unwarmed-id");
  connectivity.posture = "offline";
  reload.mockClear();
  vi.stubGlobal("location", {
    ...window.location,
    pathname: "/recipes/some-unwarmed-id",
    reload,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OfflineUnavailable", () => {
  it("shows the offline copy while Offline", () => {
    render(<OfflineUnavailable />);

    expect(screen.getByText("common.offlineFallback.title")).toBeInTheDocument();
    expect(screen.getByText("common.offlineFallback.body")).toBeInTheDocument();
    expect(reload).not.toHaveBeenCalled();
  });

  it("does not reload on an initial optimistic Live posture", () => {
    connectivity.posture = "live";
    render(<OfflineUnavailable />);

    expect(reload).not.toHaveBeenCalled();
  });

  it("reloads once when the posture transitions into Live", () => {
    const { rerender } = render(<OfflineUnavailable />);

    connectivity.posture = "live";
    rerender(<OfflineUnavailable />);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(
      window.sessionStorage.getItem("norish.offline-unavailable.reloaded:/recipes/some-unwarmed-id")
    ).toBe("1");
  });

  it("flips to the connection-is-back copy instead of reloading twice", () => {
    window.sessionStorage.setItem(
      "norish.offline-unavailable.reloaded:/recipes/some-unwarmed-id",
      "1"
    );

    const { rerender } = render(<OfflineUnavailable />);

    connectivity.posture = "live";
    rerender(<OfflineUnavailable />);

    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("common.offlineFallback.backOnlineTitle")).toBeInTheDocument();
    expect(screen.getByText("common.offlineFallback.backOnlineBody")).toBeInTheDocument();
  });
});
