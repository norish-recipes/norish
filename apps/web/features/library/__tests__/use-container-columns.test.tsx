import { useContainerColumns } from "@/features/library/hooks/use-container-columns";
import { act } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

const device = vi.hoisted(() => ({ kind: "phone" as DeviceKind }));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(undefined, {
    kind: () => device.kind,
  })
);

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
}

function Columns() {
  return <p>{`${useContainerColumns()} columns`}</p>;
}

describe("useContainerColumns in the first frame", () => {
  it.each([
    ["phone", "2 columns"],
    ["desktop", "4 columns"],
  ] as const)("answers for a %s on the server, whatever the window", (kind, markup) => {
    device.kind = kind;
    setViewportWidth(kind === "phone" ? 1280 : 400);

    expect(renderToString(<Columns />)).toContain(markup);
  });

  it("hydrates with the Device Kind's answer, then follows the window", async () => {
    device.kind = "phone";
    const container = document.createElement("div");

    container.innerHTML = renderToString(<Columns />);
    document.body.append(container);
    setViewportWidth(1280);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, <Columns />, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("4 columns");
    container.remove();
  });
});
