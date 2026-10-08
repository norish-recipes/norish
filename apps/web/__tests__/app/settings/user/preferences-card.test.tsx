import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import PreferencesCard from "@/app/(app)/settings/user/components/preferences-card";

import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

const mockContext = vi.hoisted(() => ({
  user: { preferences: {} },
  updatePreferences: vi.fn().mockResolvedValue(undefined),
  isUpdatingPreferences: false,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

vi.mock("@/app/(app)/settings/user/context", () => ({
  useUserSettingsContext: () => ({ ...mockContext, user: mockContext.user }),
}));

const todaysMealsMock = vi.hoisted(() => ({
  visibility: "always" as "always" | "planned" | "hidden",
  setVisibility: vi.fn(),
}));

const hiddenItemsMock = vi.hoisted(() => ({
  hidden: [] as string[],
  setHidden: vi.fn(),
}));

const recipePageColorMock = vi.hoisted(() => ({
  mode: "dish" as "dish" | "theme",
  setMode: vi.fn(),
}));

const deviceKindMock = vi.hoisted(() => ({ kind: "phone" as DeviceKind }));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../../helpers/device-preferences-mock")).mockDevicePreferences(
    () => ({
      todaysMeals: todaysMealsMock.visibility,
      hiddenItems: hiddenItemsMock.hidden,
      recipePageColor: recipePageColorMock.mode,
    }),
    {
      kind: () => deviceKindMock.kind,
      set: (key, next) => {
        const setters: Record<string, (next: unknown) => void> = {
          todaysMeals: todaysMealsMock.setVisibility,
          hiddenItems: hiddenItemsMock.setHidden,
          recipePageColor: recipePageColorMock.setMode,
        };

        setters[key]?.(next);
      },
    }
  )
);

let timersMock = { timersEnabled: true, globalEnabled: true } as any;

vi.mock("@/hooks/config", () => ({
  useTimersEnabledQuery: () => timersMock,
  useLocaleConfigQuery: () => ({
    enabledLocales: [
      { code: "en", name: "English" },
      { code: "de-informal", name: "Deutsch" },
    ],
    defaultLocale: "en",
  }),
}));

vi.mock("@heroui/react", () => ({
  Alert: Object.assign(({ children }: any) => <div role="note">{children}</div>, {
    Indicator: () => null,
    Content: ({ children }: any) => <>{children}</>,
    Title: ({ children }: any) => <>{children}</>,
  }),
  Card: Object.assign(({ children }: any) => <div>{children}</div>, {
    Header: ({ children }: any) => <div>{children}</div>,
    Content: ({ children }: any) => <div>{children}</div>,
  }),
  Switch: Object.assign(
    ({ isSelected, isDisabled, onChange, onValueChange, children }: any) => (
      <button
        aria-pressed={isSelected}
        disabled={isDisabled}
        type="button"
        onClick={() => (onChange ?? onValueChange)?.(!isSelected)}
      >
        {children ?? "toggle"}
      </button>
    ),
    {
      Control: ({ children }: any) => <>{children}</>,
      Content: ({ children }: any) => <>{children}</>,
      Thumb: () => <>toggle</>,
    }
  ),
  Chip: ({ children }: any) => <span>{children}</span>,
  Label: () => null,
  ListBox: Object.assign(({ children }: any) => <>{children}</>, {
    Item: ({ children, id, textValue }: any) => <option value={id}>{textValue ?? children}</option>,
    ItemIndicator: () => null,
  }),
  Select: Object.assign(
    ({ children, "aria-label": ariaLabel, value, onChange, isDisabled, selectionMode }: any) => (
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
      Popover: ({ children }: any) => <>{children}</>,
    }
  ),
}));

describe("PreferencesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hiddenItemsMock.hidden = [];
    mockContext.user = { preferences: {} } as any;
  });

  const hiddenControl = () => screen.getByRole("listbox", { name: /hidden\.title/i });

  const hiddenOptions = () => within(hiddenControl()).getAllByRole("option") as HTMLOptionElement[];

  const hiddenSelection = () =>
    hiddenOptions()
      .filter((option) => option.selected)
      .map((option) => option.value);

  it("offers every hideable item from one control", () => {
    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    expect(hiddenOptions().map((option) => option.value)).toEqual([
      "provenance",
      "nutrition",
      "notes",
      "rating",
      "favorites",
      "conversion",
      "timers",
      "cookbooks",
      "ingredientIcons",
    ]);
  });

  it("hides nothing by default", () => {
    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    expect(hiddenSelection()).toEqual([]);
  });

  it("reflects the stored hidden list", () => {
    hiddenItemsMock.hidden = ["rating", "conversion"];

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    expect(hiddenSelection()).toEqual(["rating", "conversion"]);
  });

  it("writes the chosen items to the hidden list", () => {
    hiddenItemsMock.hidden = ["rating"];

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const favorites = hiddenOptions().find((option) => option.value === "favorites")!;

    favorites.selected = true;
    fireEvent.change(hiddenControl());

    expect(hiddenItemsMock.setHidden).toHaveBeenCalledWith(["rating", "favorites"]);
  });

  it("keeps a stored name it does not recognise", () => {
    hiddenItemsMock.hidden = ["rating", "something-newer"];

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const rating = hiddenOptions().find((option) => option.value === "rating")!;

    rating.selected = false;
    fireEvent.change(hiddenControl());

    expect(hiddenItemsMock.setHidden).toHaveBeenCalledWith(["something-newer"]);
  });

  it("stops offering timers when an administrator has switched them off", () => {
    timersMock = { timersEnabled: false, globalEnabled: false } as any;

    render(<PreferencesCard />);

    expect(hiddenOptions().map((option) => option.value)).not.toContain("timers");
    // The rest of the control is unaffected.
    expect(hiddenOptions()).toHaveLength(8);
  });

  it("keeps a hidden timers choice through an administrator switching them off", () => {
    hiddenItemsMock.hidden = ["timers", "rating"];

    timersMock = { timersEnabled: false, globalEnabled: false } as any;

    render(<PreferencesCard />);

    // Not offered, so not ticked — but changing something else must not drop it,
    // or turning the capability back on would silently unhide timers.
    expect(hiddenSelection()).toEqual(["rating"]);

    const favorites = hiddenOptions().find((option) => option.value === "favorites")!;

    favorites.selected = true;
    fireEvent.change(hiddenControl());

    expect(hiddenItemsMock.setHidden).toHaveBeenCalledWith(["rating", "favorites", "timers"]);
  });

  it("renders language dropdown with current locale", () => {
    mockContext.user = { preferences: { locale: "en" } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    // Language section should be visible
    expect(screen.getByText("language.title")).toBeInTheDocument();
    expect(screen.getByText("language.description")).toBeInTheDocument();

    // Language select should be rendered
    const select = screen.getByRole("combobox", { name: /language\.title/i });

    expect(select).toBeInTheDocument();
  });

  it("calls updatePreferences with locale when language is changed", async () => {
    mockContext.user = { preferences: { locale: "en" } } as any;

    timersMock = { timersEnabled: true, globalEnabled: true } as any;

    render(<PreferencesCard />);

    const select = screen.getByRole("combobox", { name: /language\.title/i });

    fireEvent.change(select, { target: { value: "de-informal" } });

    await waitFor(() => {
      expect(mockContext.updatePreferences).toHaveBeenCalledWith({ locale: "de-informal" });
    });
  });

  it("offers the recipe page colour as a choice between the dish and the theme", () => {
    recipePageColorMock.mode = "dish";

    render(<PreferencesCard />);

    const control = screen.getByRole("combobox", { name: /recipePageColor\.title/i });
    const options = within(control).getAllByRole("option") as HTMLOptionElement[];

    expect(options.map((option) => option.value)).toEqual(["dish", "theme"]);
    expect((control as HTMLSelectElement).value).toBe("dish");

    fireEvent.change(control, { target: { value: "theme" } });

    expect(recipePageColorMock.setMode).toHaveBeenCalledWith("theme");
  });

  it("reflects the stored today's-meals rule and writes a new one", () => {
    todaysMealsMock.visibility = "planned";

    render(<PreferencesCard />);

    const select = screen.getByRole("combobox", { name: /todaySection\.title/i });

    expect((select as HTMLSelectElement).value).toBe("planned");

    fireEvent.change(select, { target: { value: "hidden" } });

    expect(todaysMealsMock.setVisibility).toHaveBeenCalledWith("hidden");

    todaysMealsMock.visibility = "always";
  });

  it("opens the groceries panel after planning by default and stores a new choice with the user", () => {
    render(<PreferencesCard />);

    const control = screen.getByRole("combobox", { name: /afterPlanning\.title/i });
    const options = within(control).getAllByRole("option") as HTMLOptionElement[];

    expect(options.map((option) => option.value)).toEqual([
      "nothing",
      "openGroceries",
      "addGroceries",
    ]);
    expect((control as HTMLSelectElement).value).toBe("openGroceries");

    fireEvent.change(control, { target: { value: "addGroceries" } });

    expect(mockContext.updatePreferences).toHaveBeenCalledWith({ afterPlanning: "addGroceries" });
  });

  it("reflects a stored after-planning choice", () => {
    mockContext.user = { preferences: { afterPlanning: "nothing" } } as any;

    render(<PreferencesCard />);

    const control = screen.getByRole("combobox", { name: /afterPlanning\.title/i });

    expect((control as HTMLSelectElement).value).toBe("nothing");
  });

  it("says which kind of device its display choices apply to", () => {
    deviceKindMock.kind = "desktop";

    render(<PreferencesCard />);

    expect(screen.getByRole("note")).toHaveTextContent("deviceKind.desktop");

    deviceKindMock.kind = "phone";
  });
});
