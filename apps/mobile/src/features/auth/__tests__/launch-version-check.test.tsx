// @vitest-environment jsdom
import type { ServerAddressCheck } from "@/lib/network/server-address";
import React, { createContext } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const address = "https://norish.example";
const tooOld = { outcome: "too-old", address, version: "0.26.2" } as const;
let phase: "covered" | "leaving" | "done" = "leaving";
let settle = (_check: ServerAddressCheck) => {};
const checkServerAddress = vi.fn(
  () =>
    new Promise<ServerAddressCheck>((resolve) => {
      settle = resolve;
    })
);
const push = vi.fn();
const ServerAddressContext = createContext<string | null>(null);

vi.mock("@/components/launch", () => ({ useLaunchPhase: () => phase }));
vi.mock("@/features/auth/utils/check-server-address", () => ({ checkServerAddress }));
vi.mock("@/lib/network/server-address", () => ({
  ServerAddressContext,
  getServerAddress: () => address,
}));
vi.mock("expo-router", () => ({ router: { push } }));

const updateServer = { pathname: "/update-server", params: { address, version: "0.26.2" } };

// The check's state is per launch, so every test starts on a fresh module.
async function launch() {
  vi.resetModules();
  const { LaunchVersionCheck } = await import("@/features/auth/components/launch-version-check");

  return (enabled = true) => (
    <ServerAddressContext value={address}>
      <LaunchVersionCheck enabled={enabled} />
    </ServerAddressContext>
  );
}

beforeEach(() => {
  phase = "leaving";
  checkServerAddress.mockClear();
  push.mockClear();
});

describe("LaunchVersionCheck", () => {
  it("keeps a too old answer across the sign-in re-key's remount", async () => {
    const tree = await launch();
    const first = render(tree());

    first.unmount();
    const second = render(tree());

    await act(async () => settle(tooOld));
    phase = "done";
    second.rerender(tree());

    expect(checkServerAddress).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(updateServer);
  });

  it("checks a stack first mounted after the launch finished, as after a storage retry", async () => {
    phase = "done";
    const tree = await launch();

    render(tree());
    await act(async () => settle(tooOld));

    expect(push).toHaveBeenCalledWith(updateServer);
  });

  it("opens Update your server once per launch", async () => {
    phase = "done";
    const tree = await launch();
    const first = render(tree());

    await act(async () => settle(tooOld));
    first.unmount();
    render(tree());
    await act(async () => {});

    expect(push).toHaveBeenCalledTimes(1);
  });

  it("opens Update your server unanimated while the splash still covers the screen", async () => {
    phase = "covered";
    const tree = await launch();

    render(tree());
    await act(async () => settle(tooOld));

    expect(push).toHaveBeenCalledWith({
      pathname: "/update-server",
      params: { address, version: "0.26.2", instant: "1" },
    });
  });

  it("waits for the splash to leave before navigating", async () => {
    const tree = await launch();
    const view = render(tree());

    await act(async () => settle(tooOld));
    expect(push).not.toHaveBeenCalled();

    phase = "done";
    view.rerender(tree());
    expect(push).toHaveBeenCalledWith(updateServer);
  });
});
