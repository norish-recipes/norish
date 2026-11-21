// @vitest-environment jsdom
import { useStartImport } from "@/features/recipes/hooks/use-start-import";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = { back: vi.fn() };

vi.mock("expo-router", () => ({ useRouter: () => router }));

describe("useStartImport", () => {
  beforeEach(() => router.back.mockClear());

  it("starts an import once however often it is pressed, and closes the sheet", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useStartImport());
    const press = result.current(run);

    press();
    press();
    result.current(run)();

    expect(run).toHaveBeenCalledOnce();
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("keeps the sheet and lets the next press run when one started nothing", () => {
    const run = vi.fn().mockReturnValueOnce(false).mockReturnValue(undefined);
    const { result } = renderHook(() => useStartImport());
    const press = result.current(run);

    press();
    expect(router.back).not.toHaveBeenCalled();
    press();
    press();

    expect(run).toHaveBeenCalledTimes(2);
    expect(router.back).toHaveBeenCalledOnce();
  });

  it("ignores a second control's press once the first started", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useStartImport());

    result.current(first)();
    result.current(second)();

    expect(second).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalledOnce();
  });
});
