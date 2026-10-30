import { useContainerColumns } from "@/hooks/use-container-columns";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

const device = vi.hoisted(() => ({ kind: "phone" as DeviceKind }));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../helpers/device-preferences-mock")).mockDevicePreferences(undefined, {
    kind: () => device.kind,
  })
);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

function Layout() {
  return <p>{`${useIsMobile() ? "phone" : "desktop"} ${useContainerColumns()}`}</p>;
}

describe("useIsMobile", () => {
  it("reports mobile below the md breakpoint", () => {
    setViewportWidth(500);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it("reports desktop at the breakpoint and follows resizes", () => {
    setViewportWidth(768);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(600);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(true);

    act(() => {
      setViewportWidth(1280);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(false);
  });
});

describe("the first frame's layout", () => {
  it.each([
    ["phone", "phone 2"],
    ["desktop", "desktop 4"],
  ] as const)("answers for a %s on the server, whatever the window", (kind, markup) => {
    device.kind = kind;
    setViewportWidth(kind === "phone" ? 1280 : 400);

    expect(renderToString(<Layout />)).toContain(markup);
  });

  it("hydrates with the Device Kind's answer, then follows the window", async () => {
    device.kind = "phone";
    const container = document.createElement("div");

    container.innerHTML = renderToString(<Layout />);
    document.body.append(container);
    setViewportWidth(1280);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <Layout />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("desktop 4");
    container.remove();
  });
});
