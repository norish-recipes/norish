// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const connectivity = { isOffline: false };

vi.mock("@norish/shared-react/offline/react", () => ({ useConnectivity: () => connectivity }));

const { ConnectivityMirror, isOfflineNow } = await import("@/lib/offline/offline-now");
const { settingsWrite } = await import("@/features/settings/utils/settings-write");

describe("isOfflineNow", () => {
  it("reports a change to a getter and a write taken before it, with no render of their own", () => {
    const app = render(<ConnectivityMirror />);
    const offline = isOfflineNow;
    const send = vi.fn();
    const save = settingsWrite(send);

    expect(offline()).toBe(false);

    connectivity.isOffline = true;
    app.rerender(<ConnectivityMirror />);
    expect(offline()).toBe(true);
    save();
    expect(send).not.toHaveBeenCalled();
  });
});
