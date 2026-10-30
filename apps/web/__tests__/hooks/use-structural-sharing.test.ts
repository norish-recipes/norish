import { useStructuralSharing } from "@/hooks/use-structural-sharing";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("useStructuralSharing", () => {
  it("keeps the identity of every part that did not change, and only those", () => {
    const first = [
      { key: "a", items: [{ id: 1 }] },
      { key: "b", items: [{ id: 2 }] },
    ];
    const { result, rerender } = renderHook(({ value }) => useStructuralSharing(value), {
      initialProps: { value: first },
    });

    // Rebuilt from the same data: everything is the last render's.
    rerender({ value: structuredClone(first) });
    expect(result.current).toBe(first);

    // One part changed: the rest keep their identity.
    const changed = structuredClone(first);

    changed[1]!.items.push({ id: 3 });
    rerender({ value: changed });
    expect(result.current).not.toBe(first);
    expect(result.current[0]).toBe(first[0]);
    expect(result.current[1]).toEqual(changed[1]);
  });
});
