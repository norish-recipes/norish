// @vitest-environment jsdom
import { useStartOnce } from "@/features/recipes/hooks/use-start-once";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("useStartOnce", () => {
  it("starts an import once however often it is pressed", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useStartOnce());
    const press = result.current(run);

    press();
    press();
    result.current(run)();

    expect(run).toHaveBeenCalledOnce();
  });

  it("lets the next press run when one started nothing", () => {
    const run = vi.fn().mockReturnValueOnce(false).mockReturnValue(undefined);
    const { result } = renderHook(() => useStartOnce());
    const press = result.current(run);

    press();
    press();
    press();

    expect(run).toHaveBeenCalledTimes(2);
  });
});
