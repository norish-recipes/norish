import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { ReactNode } from "react";
import PreferencesCard from "@/features/account/components/preferences-card";

import type { useTimersEnabledQuery } from "@norish/shared-react/config";
import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";
import type { UserPreferencesDto } from "@norish/shared/contracts/zod/user";

type Children = { children?: ReactNode };

const mockAccount = vi.hoisted(() => {
  const user: Partial<User> = { preferences: {} };

  return {
    user,
    updatePreferences: vi.fn().mockResolvedValue(undefined),
    isUpdatingPreferences: false,
  };
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockRouterRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

// A language save is its own mutation, so the card's preferences mutation is idle meanwhile.
const localeMock = vi.hoisted(() => ({ isChanging: false }));

vi.mock("@/hooks/user/use-locale", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/user/use-locale")>();

  return {
    useLocale: () => {
      const locale = actual.useLocale();

      return { ...locale, isChanging: locale.isChanging || localeMock.isChanging };
    },
  };
});

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

vi.mock("@norish/shared-react/reader", async () => ({
  usePreferencesMutation: () => mockAccount,
  ...(await (
    await import("@/__tests__/helpers/reader-mock")
  ).mockDevicePreferences(
    () => ({
      todaySectionVisibility: todaysMealsMock.visibility,
      hiddenItems: hiddenItemsMock.hidden,
      recipePageColor: recipePageColorMock.mode,
    }),
    {
      kind: () => deviceKindMock.kind,
      reader: () => ({ user: mockAccount.user, permissions: permissionsMock }),
      set: (key, next) => {
        const setters: Record<string, (next: unknown) => void> = {
          todaySectionVisibility: todaysMealsMock.setVisibility,
          hiddenItems: hiddenItemsMock.setHidden,
          recipePageColor: recipePageColorMock.setMode,
        };

        setters[key]?.(next);
      },
    }
  )),
}));

const permissionsMock = vi.hoisted(() => ({ isAIEnabled: false }));

/** The timers capability as an administrator left it, with nothing hidden on this device. */
const timers = (enabled: boolean): ReturnType<typeof useTimersEnabledQuery> => ({
  timersEnabled: enabled,
  globalEnabled: enabled,
  isLoading: false,
  error: null,
});
const withPreferences = (preferences: UserPreferencesDto): Partial<User> => ({ preferences });

let timersMock = timers(true);

vi.mock("@norish/shared-react/config", () => ({
  useTimersEnabledQuery: () => timersMock,
  useLocaleConfigQuery: () => ({
    enabledLocales: [
      { code: "en", name: "English" },
      { code: "de-informal", name: "Deutsch" },
    ],
    defaultLocale: "en",
  }),
}));

// The popover itself is HeroUI's; what is pinned here is what it says.
vi.mock("@/components/shared/info-hint", () => ({
  InfoHint: ({ label, children }: Children & { label: string }) => (
    <div aria-label={label} role="note">
      {children}
    </div>
  ),
}));

vi.mock("@heroui/react", () => ({
  Card: Object.assign(({ children }: Children) => <div>{children}</div>, {
    Header: ({ children }: Children) => <div>{children}</div>,
    Content: ({ children }: Children) => <div>{children}</div>,
  }),
  Switch: Object.assign(
    ({
      isSelected,
      isDisabled,
      onChange,
      onValueChange,
      children,
    }: Children & {
      isSelected?: boolean;
      isDisabled?: boolean;
      onChange?: (selected: boolean) => void;
      onValueChange?: (selected: boolean) => void;
    }) => (
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
      Control: ({ children }: Children) => <>{children}</>,
      Content: ({ children }: Children) => <>{children}</>,
      Thumb: () => <>toggle</>,
    }
  ),
  Chip: ({ children }: Children) => <span>{children}</span>,
  Label: () => null,
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

describe("PreferencesCard", () => {
  beforeEach(() => {
    permissionsMock.isAIEnabled = false;
    hiddenItemsMock.hidden = [];
    mockAccount.user = withPreferences({});
    localeMock.isChanging = false;
  });

  const hiddenControl = () => screen.getByRole("listbox", { name: /hidden\.title/i });

  const hiddenOptions = () => within(hiddenControl()).getAllByRole("option") as HTMLOptionElement[];

  const hiddenSelection = () =>
    hiddenOptions()
      .filter((option) => option.selected)
      .map((option) => option.value);

  it("offers every hideable item from one control", () => {
    timersMock = timers(true);

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
    timersMock = timers(true);

    render(<PreferencesCard />);

    expect(hiddenSelection()).toEqual([]);
  });

  it("reflects the stored hidden list", () => {
    hiddenItemsMock.hidden = ["rating", "conversion"];

    timersMock = timers(true);

    render(<PreferencesCard />);

    expect(hiddenSelection()).toEqual(["rating", "conversion"]);
  });

  it("writes the chosen items to the hidden list", () => {
    hiddenItemsMock.hidden = ["rating"];

    timersMock = timers(true);

    render(<PreferencesCard />);

    const favorites = hiddenOptions().find((option) => option.value === "favorites")!;

    favorites.selected = true;
    fireEvent.change(hiddenControl());

    expect(hiddenItemsMock.setHidden).toHaveBeenCalledWith(["rating", "favorites"]);
  });

  it("keeps a stored name it does not recognise", () => {
    hiddenItemsMock.hidden = ["rating", "something-newer"];

    timersMock = timers(true);

    render(<PreferencesCard />);

    const rating = hiddenOptions().find((option) => option.value === "rating")!;

    rating.selected = false;
    fireEvent.change(hiddenControl());

    expect(hiddenItemsMock.setHidden).toHaveBeenCalledWith(["something-newer"]);
  });

  it("stops offering timers when an administrator has switched them off", () => {
    timersMock = timers(false);

    render(<PreferencesCard />);

    expect(hiddenOptions().map((option) => option.value)).not.toContain("timers");
    // The rest of the control is unaffected.
    expect(hiddenOptions()).toHaveLength(8);
  });

  it("keeps a hidden timers choice through an administrator switching them off", () => {
    hiddenItemsMock.hidden = ["timers", "rating"];

    timersMock = timers(false);

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
    mockAccount.user = withPreferences({ locale: "en" });

    timersMock = timers(true);

    render(<PreferencesCard />);

    expect(screen.getByText("language.title")).toBeInTheDocument();
    expect(screen.getByText("language.description")).toBeInTheDocument();

    const select = screen.getByRole("combobox", { name: /language\.title/i });

    expect(select).toBeInTheDocument();
  });

  it("calls updatePreferences with locale when language is changed", async () => {
    mockAccount.user = withPreferences({ locale: "en" });

    timersMock = timers(true);

    render(<PreferencesCard />);

    const select = screen.getByRole("combobox", { name: /language\.title/i });

    fireEvent.change(select, { target: { value: "de-informal" } });

    await waitFor(() => {
      expect(mockAccount.updatePreferences).toHaveBeenCalledWith({ locale: "de-informal" });
    });
  });

  it("holds the account's choices while a language save is under way", () => {
    localeMock.isChanging = true;

    render(<PreferencesCard />);

    for (const name of [/language\.title/i, /afterPlanning\.title/i, /measurements\.title/i]) {
      expect(screen.getByRole("combobox", { name })).toBeDisabled();
    }
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

    expect(mockAccount.updatePreferences).toHaveBeenCalledWith({ afterPlanning: "addGroceries" });
  });

  it("reflects a stored after-planning choice", () => {
    mockAccount.user = withPreferences({ afterPlanning: "nothing" });

    render(<PreferencesCard />);

    const control = screen.getByRole("combobox", { name: /afterPlanning\.title/i });

    expect((control as HTMLSelectElement).value).toBe("nothing");
  });

  it("offers converting with AI only where AI is on, and stores the choice with the user", () => {
    mockAccount.user = withPreferences({ measurementSystem: "usWithAI" });

    const { unmount } = render(<PreferencesCard />);
    const control = () => screen.getByRole("combobox", { name: /measurements\.title/i });
    const values = () =>
      (within(control()).getAllByRole("option") as HTMLOptionElement[]).map((o) => o.value);

    expect(values()).toEqual(["off", "metric", "us"]);
    expect((control() as HTMLSelectElement).value).toBe("us");
    unmount();

    permissionsMock.isAIEnabled = true;
    render(<PreferencesCard />);

    expect(values()).toEqual(["off", "metric", "us", "metricWithAI", "usWithAI"]);
    expect((control() as HTMLSelectElement).value).toBe("usWithAI");

    fireEvent.change(control(), { target: { value: "metric" } });

    expect(mockAccount.updatePreferences).toHaveBeenCalledWith({ measurementSystem: "metric" });
  });

  it("says behind the title which kind of device its display choices apply to", () => {
    deviceKindMock.kind = "desktop";

    render(<PreferencesCard />);

    expect(screen.getByRole("note", { name: "deviceKind.help" })).toHaveTextContent(
      "deviceKind.desktop"
    );

    deviceKindMock.kind = "phone";
  });
});
