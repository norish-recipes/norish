import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dateKey } from "@norish/shared/lib/helpers";

import { useToday } from "../use-today";

function Today({ server }: { server?: string }) {
  return <>{useToday(server)}</>;
}

afterEach(() => vi.useRealTimers());

describe("useToday", () => {
  it("renders the server's date on the server", () => {
    expect(renderToString(<Today server="2020-02-02" />)).toBe("2020-02-02");
  });

  it("hydrates with the server's date, then follows the device's", async () => {
    const page = <Today server="2020-02-02" />;
    const container = document.createElement("div");

    container.innerHTML = renderToString(page);
    document.body.append(container);
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe(dateKey(new Date()));
    container.remove();
  });

  it("notices the day turning over within a minute", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 30));
    const { result } = renderHook(() => useToday());

    expect(result.current).toBe("2026-11-13");

    act(() => {
      vi.setSystemTime(new Date(2026, 10, 14, 0, 0, 10));
      vi.advanceTimersByTime(60_000);
    });

    expect(result.current).toBe("2026-11-14");
  });
});
