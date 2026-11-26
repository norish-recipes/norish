// @vitest-environment jsdom
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const screens = vi.hoisted(() => new Map<string, { sheetAllowedDetents?: unknown }>());

vi.mock("expo-router", () => {
  const Stack = ({ children }: { children: ReactNode }) => children;

  Stack.Screen = ({
    name,
    options,
  }: {
    name: string;
    options?: { sheetAllowedDetents?: unknown };
  }) => {
    screens.set(name, options ?? {});

    return null;
  };

  return { Stack };
});
vi.mock("../components/settings-write-notice", () => ({ SettingsWriteNotice: () => null }));
vi.mock("@/lib/header-title", () => ({ HEADER_TITLE_STYLE: {} }));

const { SettingsStack } = await import("../components/settings-stack");

describe("SettingsStack", () => {
  it("gives a sheet whose content loads or swaps after its first layout one fixed height", () => {
    render(<SettingsStack />);

    for (const name of ["content-add", "content-entry", "ingredient", "ingredient-add"]) {
      expect(screens.get(name)?.sheetAllowedDetents, name).not.toBe("fitToContents");
      expect(screens.get(name)?.sheetAllowedDetents, name).toEqual([0.62]);
    }
  });
});
