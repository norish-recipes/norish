import RegisterServiceWorker, { collectRuntimeAssets } from "@/components/register-service-worker";
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

  it("collects only observed same-origin Next script and stylesheet assets", () => {
    document.head.innerHTML = `
      <script src="/_next/static/chunks/app.js"></script>
      <link rel="stylesheet" href="/_next/static/css/app.css" />
      <link rel="stylesheet" href="/theme.css" />
      <script src="https://other.test/_next/static/foreign.js"></script>
    `;

    expect(collectRuntimeAssets()).toEqual([
      `${window.location.origin}/_next/static/chunks/app.js`,
      `${window.location.origin}/_next/static/css/app.css`,
    ]);
  });

  it("posts the exact canonical route and assets only for a confirmed live scope", async () => {
    document.head.innerHTML = '<script src="/_next/static/chunks/app.js"></script>';

    render(<RegisterServiceWorker />);

    await waitFor(() => expect(register).toHaveBeenCalledWith("/sw.js"));
    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith({
        type: "CONFIRM_ROUTE_SHELL",
        route: "/",
        assets: [`${window.location.origin}/_next/static/chunks/app.js`],
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
