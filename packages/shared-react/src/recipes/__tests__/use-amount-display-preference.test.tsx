import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { DevicePreferencesForVisit } from "@norish/shared-react/reader";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  deviceBlocks,
} from "@norish/shared/contracts/zod/device-preferences";

import { keyOf, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useAmountDisplayPreference } from "../use-amount-display-preference";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const write = vi.fn();
let latest!: ReturnType<typeof useAmountDisplayPreference>;

function Probe() {
  latest = useAmountDisplayPreference();

  return <span data-testid="mode">{latest.mode}</span>;
}

function renderProbe({
  amountDisplay,
  forVisit = false,
}: { amountDisplay?: "decimal" | "fraction"; forVisit?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const Wrapper = createTestWrapper(queryClient, fakePlatformAdapter("phone"));

  queryClient.setQueryData(
    keyOf("user.getDevicePreferences"),
    deviceBlocks({
      phone: { ...DEVICE_PREFERENCE_DEFAULTS, ...(amountDisplay && { amountDisplay }) },
    })
  );

  return render(
    <Wrapper>
      {forVisit ? (
        <DevicePreferencesForVisit>
          <Probe />
        </DevicePreferencesForVisit>
      ) : (
        <Probe />
      )}
    </Wrapper>
  );
}

beforeEach(() => {
  resetTRPCFake();
  serveTRPC(async (path, input) => {
    if (path === "user.setDevicePreferences") return write(input);

    return Promise.reject(new Error("not served in this test"));
  });
  write.mockReset().mockReturnValue({ success: true });
});

describe("useAmountDisplayPreference", () => {
  it("keeps the shared hook's interface over the stored mode", () => {
    renderProbe({ amountDisplay: "decimal" });

    expect(screen.getByTestId("mode").textContent).toBe("decimal");
  });

  it("toggles between the two formats", async () => {
    renderProbe();

    expect(screen.getByTestId("mode").textContent).toBe("fraction");

    act(() => latest.toggleMode());
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("decimal"));

    act(() => latest.toggleMode());
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("fraction"));
  });

  it("sets an explicit mode", async () => {
    renderProbe();

    act(() => latest.setMode("decimal"));

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("decimal"));
  });

  it("lets a signed-out reader of a shared recipe switch for the visit", async () => {
    renderProbe({ forVisit: true });

    act(() => latest.toggleMode());

    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("decimal"));
  });
});
