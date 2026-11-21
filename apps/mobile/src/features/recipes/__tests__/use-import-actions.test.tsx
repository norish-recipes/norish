// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const held = vi.hoisted(() => ({ ai: true }));

vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/reader", () => ({
  usePermissions: (select: (permissions: { isAIEnabled: boolean }) => boolean) =>
    select({ isAIEnabled: held.ai }),
}));

const { useImportActions } = await import("../hooks/use-import-actions");

const run = (props: Partial<Parameters<typeof useImportActions>[0]> = {}) =>
  renderHook(() =>
    useImportActions({ isDisabled: false, onImport: vi.fn(), onAIImport: vi.fn(), ...props })
  ).result.current;

describe("useImportActions", () => {
  beforeEach(() => {
    held.ai = true;
  });

  it("makes Import the confirm and AI import a header action", () => {
    const { confirm, secondary } = run();

    expect(confirm).toMatchObject({ label: "common.actions.import", disabled: false });
    expect(secondary).toMatchObject([{ label: "common.actions.aiImport", symbol: "sparkles" }]);
  });

  it("has no AI import with AI off", () => {
    held.ai = false;

    expect(run().secondary).toEqual([]);
  });

  it("disables AI import on its own rule, which defaults to the confirm's", () => {
    expect(run({ isDisabled: true }).secondary[0]?.disabled).toBe(true);
    expect(run({ isAIDisabled: true }).confirm.disabled).toBe(false);
    expect(run({ isAIDisabled: true }).secondary[0]?.disabled).toBe(true);
  });
});
