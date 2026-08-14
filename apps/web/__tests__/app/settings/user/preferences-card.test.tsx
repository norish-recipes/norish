import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import PreferencesCard from "@/app/(app)/settings/user/components/preferences-card";

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

vi.mock("@/context/todays-meals-visibility-context", () => ({
  useTodaySectionVisibility: () => [todaysMealsMock.visibility, todaysMealsMock.setVisibility],
}));

const hiddenItemsMock = vi.hoisted(() => ({
  hidden: [] as string[],
  setHidden: vi.fn(),
}));

vi.mock("@/context/hidden-items-context", () => ({
  useHiddenItemsState: () => [hiddenItemsMock.hidden, hiddenItemsMock.setHidden],
}));

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
    expect(hiddenOptions()).toHaveLength(6);
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

  it("reflects the stored today's-meals rule and writes a new one", () => {
    todaysMealsMock.visibility = "planned";

    render(<PreferencesCard />);

    const select = screen.getByRole("combobox", { name: /todaySection\.title/i });

    expect((select as HTMLSelectElement).value).toBe("planned");

    fireEvent.change(select, { target: { value: "hidden" } });

    expect(todaysMealsMock.setVisibility).toHaveBeenCalledWith("hidden");

    todaysMealsMock.visibility = "always";
  });
});
