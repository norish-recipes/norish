/** The Permission Policy card: Everyone or Household, and never an edit or delete wider than view. */
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { setConfigs } from "./admin-config-fake";

const saveRecipePolicy = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  usePermissionPolicyMutations: () => ({ saveRecipePolicy }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/settings/settings-card", () => ({
  SettingsCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/settings/setting-row", () => ({
  SettingRow: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/shared/note", () => ({ Note: () => null }));
// Each select as buttons for its levels, a disabled level a disabled button.
vi.mock("@/features/admin/components/permissions/permission-level-select", () => ({
  PermissionLevelSelect: ({
    ariaLabel,
    disabledLevels = [],
    onChange,
  }: {
    ariaLabel: string;
    disabledLevels?: string[];
    onChange: (level: string) => void;
  }) => (
    <div>
      {["everyone", "household"].map((level) => (
        <button
          key={level}
          disabled={disabledLevels.includes(level)}
          type="button"
          onClick={() => onChange(level)}
        >
          {`${ariaLabel}:${level}`}
        </button>
      ))}
    </div>
  ),
}));

const { default: PermissionPolicyCard } =
  await import("@/features/admin/components/permissions/permission-policy-card");

const button = (row: string, level: string) =>
  screen.getByRole("button", { name: `${row}:${level}` }) as HTMLButtonElement;

describe("PermissionPolicyCard", () => {
  beforeEach(() => saveRecipePolicy.mockClear());

  it("offers edit and delete for everyone only while view is everyone", () => {
    setConfigs({
      [ServerConfigKeys.RECIPE_PERMISSION_POLICY]: {
        view: "household",
        edit: "household",
        delete: "household",
      },
    });
    render(<PermissionPolicyCard />);

    expect(button("viewRecipes", "everyone").disabled).toBe(false);
    expect(button("editRecipes", "everyone").disabled).toBe(true);
    expect(button("deleteRecipes", "everyone").disabled).toBe(true);
  });

  it("narrows edit and delete with view, in one save", () => {
    setConfigs({
      [ServerConfigKeys.RECIPE_PERMISSION_POLICY]: {
        view: "everyone",
        edit: "everyone",
        delete: "everyone",
      },
    });
    render(<PermissionPolicyCard />);
    fireEvent.click(button("viewRecipes", "household"));

    expect(saveRecipePolicy).toHaveBeenCalledWith({
      view: "household",
      edit: "household",
      delete: "household",
    });
  });
});
