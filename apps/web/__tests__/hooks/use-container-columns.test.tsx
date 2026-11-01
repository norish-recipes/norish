import { useContainerColumns } from "@/hooks/use-container-columns";
import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DeviceKind, RecipeViewMode } from "@norish/shared/contracts/zod/device-preferences";

const device = vi.hoisted(() => ({ kind: "phone" as DeviceKind }));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../helpers/device-preferences-mock")).mockDevicePreferences(undefined, {
    kind: () => device.kind,
  })
);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

function Columns({ viewMode }: { viewMode: RecipeViewMode }) {
  return <p>{`${viewMode} ${useContainerColumns(viewMode)}`}</p>;
}

describe("useContainerColumns", () => {
  it.each([
    [390, "grid", 2],
    [1023, "grid", 2],
    [1024, "grid", 4],
    [1920, "grid", 4],
    [390, "list", 1],
    [1023, "list", 1],
    [1024, "list", 2],
    [1279, "list", 2],
    [1280, "list", 3],
    [1920, "list", 3],
  ] as const)("at %ipx lays the %s out in %i columns", (width, viewMode, columns) => {
    setViewportWidth(width);

    const { result } = renderHook(() => useContainerColumns(viewMode));

    expect(result.current).toBe(columns);
  });

  it("follows the list across the breakpoint as the window resizes", () => {
    setViewportWidth(1280);

    const { result } = renderHook(() => useContainerColumns("list"));

    expect(result.current).toBe(3);

    act(() => {
      setViewportWidth(1100);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(2);

    act(() => {
      setViewportWidth(800);
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toBe(1);
  });

  it.each([
    ["phone", "list 1"],
    ["desktop", "list 3"],
  ] as const)("draws the list for a %s on the server, whatever the window", (kind, markup) => {
    device.kind = kind;
    setViewportWidth(kind === "phone" ? 1920 : 400);

    expect(renderToString(<Columns viewMode="list" />)).toContain(markup);
  });

  it("hydrates a wide desktop's list without a mismatch", async () => {
    device.kind = "desktop";
    const container = document.createElement("div");

    container.innerHTML = renderToString(<Columns viewMode="list" />);
    document.body.append(container);
    setViewportWidth(1920);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <Columns viewMode="list" />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("list 3");
    container.remove();
  });
});
