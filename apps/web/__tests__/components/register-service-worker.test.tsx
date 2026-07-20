import RegisterServiceWorker, { isOfflineShellRoute } from "@/components/register-service-worker";
import { render, waitFor } from "@testing-library/react";

const offline = vi.hoisted(() => ({
  value: {
    activeScope: { key: "scope" },
    phase: "live",
    renderIdentityOnly: false,
  },
}));

vi.mock("@/context/offline-web-context", () => ({
  useOfflineWeb: () => offline.value,
}));

describe("RegisterServiceWorker", () => {
  const postMessage = vi.fn();
  const register = vi.fn();

  beforeEach(() => {
    postMessage.mockReset();
    register.mockReset();
    register.mockResolvedValue({ active: { postMessage } });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: null, register },
    });
    offline.value = {
      activeScope: { key: "scope" },
      phase: "live",
      renderIdentityOnly: false,
    };
    document.head.innerHTML = "";
  });

  it("limits cold-start shells to the three offline read surfaces", () => {
    expect(["/", "/calendar", "/groceries"].every(isOfflineShellRoute)).toBe(true);
    expect(isOfflineShellRoute("/recipes/one")).toBe(false);
    expect(isOfflineShellRoute("/settings")).toBe(false);
  });

  it("posts the canonical route only for a confirmed live scope", async () => {
    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({
        type: "CONFIRM_ROUTE_SHELL",
        route: "/",
      })
    );
  });

  it("waits for the first active worker before confirming a route after initial install", async () => {
    const ready = Promise.resolve({ active: { postMessage } });

    register.mockResolvedValue({ active: null });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { controller: null, ready, register },
    });

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({
        type: "CONFIRM_ROUTE_SHELL",
        route: "/",
      })
    );
  });

  it("does not confirm a route from cached render-only identity", async () => {
    offline.value = {
      activeScope: { key: "scope" },
      phase: "cached",
      renderIdentityOnly: true,
    };

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledOnce());
    expect(postMessage).not.toHaveBeenCalled();
  });
});
