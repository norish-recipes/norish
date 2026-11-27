/**
 * The General card's shopping list setting: the administrator picks where recipe ingredients go,
 * it saves as it is picked, and Bring! comes with a notice that the instance must be public.
 */
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { setConfigs } from "./admin-config-fake";

type Children = { children?: ReactNode };

const setGroceryListProvider = vi.hoisted(() => vi.fn(async (_provider: string) => undefined));

vi.mock("@norish/shared-react/admin", async () => ({
  useAdminConfig: (await import("./admin-config-fake")).useAdminConfig,
  useGeneralConfigMutations: () => ({
    setRegistration: vi.fn(),
    saveLocales: vi.fn(),
    setGroceryListProvider,
  }),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/components/settings/settings-card", () => ({
  SettingsCard: ({ children }: Children) => <div>{children}</div>,
}));
vi.mock("@/components/settings/settings-switch", () => ({ default: () => null }));
vi.mock("@/components/settings/archive-export-button", () => ({ default: () => null }));
vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children }: Children) => <button type="button">{children}</button>,
  ActionButtonGroup: ({ children }: Children) => <div>{children}</div>,
}));
vi.mock("../components/unsaved-changes-chip", () => ({ UnsavedChangesChip: () => null }));
vi.mock("@heroui/react", () => ({
  Separator: () => <hr />,
  toast: vi.fn(),
  ListBox: Object.assign(({ children }: Children) => <>{children}</>, {
    Item: ({ children, id, textValue }: Children & { id: string; textValue?: string }) => (
      <option value={id}>{textValue ?? children}</option>
    ),
    ItemIndicator: () => null,
  }),
  Select: Object.assign(
    ({
      children,
      "aria-label": ariaLabel,
      value,
      onChange,
      isDisabled,
      selectionMode,
    }: Children & {
      "aria-label"?: string;
      value?: string | string[] | null;
      onChange?: (value: string | string[]) => void;
      isDisabled?: boolean;
      selectionMode?: "single" | "multiple";
    }) => (
      <select
        aria-label={ariaLabel}
        disabled={isDisabled}
        multiple={selectionMode === "multiple"}
        value={value ?? ""}
        onChange={(e) =>
          onChange?.(
            selectionMode === "multiple"
              ? Array.from(e.target.selectedOptions, (option) => option.value)
              : e.target.value
          )
        }
      >
        {children}
      </select>
    ),
    {
      Trigger: () => null,
      Value: () => null,
      Indicator: () => null,
      Popover: ({ children }: Children) => <>{children}</>,
    }
  ),
}));

const { default: GeneralCard } = await import("@/features/admin/components/general/general-card");

const providerSelect = () =>
  screen.getByRole("combobox", { name: "groceryListProvider.title" }) as HTMLSelectElement;

describe("GeneralCard's shopping list", () => {
  beforeEach(() => {
    setGroceryListProvider.mockClear();
    setConfigs({
      registration_enabled: true,
      locale_config: { defaultLocale: "en", locales: { en: { name: "English", enabled: true } } },
    });
  });

  it("offers the built-in list and Bring!, on the built-in list until the config says otherwise", () => {
    render(<GeneralCard />);

    expect(providerSelect()).toHaveValue("builtin");
    expect(Array.from(providerSelect().options, (option) => option.value)).toEqual([
      "builtin",
      "bring",
    ]);
    expect(screen.queryByText("groceryListProvider.bringNotice")).not.toBeInTheDocument();
  });

  it("saves Bring! as soon as it is picked", async () => {
    render(<GeneralCard />);

    fireEvent.change(providerSelect(), { target: { value: "bring" } });

    await waitFor(() => expect(setGroceryListProvider).toHaveBeenCalledExactlyOnceWith("bring"));
  });

  it("shows the notice that the instance must be reachable while Bring! is chosen", () => {
    setConfigs({ grocery_list_provider: "bring" });
    render(<GeneralCard />);

    expect(providerSelect()).toHaveValue("bring");
    expect(screen.getByText("groceryListProvider.bringNotice")).toBeInTheDocument();
  });

  it("saves the built-in list again when it is picked back", async () => {
    setConfigs({ grocery_list_provider: "bring" });
    render(<GeneralCard />);

    fireEvent.change(providerSelect(), { target: { value: "builtin" } });

    await waitFor(() => expect(setGroceryListProvider).toHaveBeenCalledExactlyOnceWith("builtin"));
  });

  it("does not save the choice that is already made", () => {
    setConfigs({ grocery_list_provider: "bring" });
    render(<GeneralCard />);

    fireEvent.change(providerSelect(), { target: { value: "bring" } });

    expect(setGroceryListProvider).not.toHaveBeenCalled();
  });
});
