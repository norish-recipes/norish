import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import NavbarUserMenu from "@/components/navbar/navbar-user-menu";

const mockSignOut = vi.hoisted(() => vi.fn());
const mockCycleLocale = vi.hoisted(() => vi.fn());
const mockCycleTheme = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: mockCycleTheme,
    theme: "light",
  }),
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({
    signOut: mockSignOut,
    user: {
      email: "alice@example.com",
      id: "user-1",
      image: null,
      name: "Alice",
    },
  }),
}));

vi.mock("@/hooks/config", () => ({
  useVersionQuery: () => ({
    currentVersion: "1.2.3",
    latestVersion: null,
    releaseUrl: null,
    updateAvailable: false,
  }),
}));

vi.mock("@/hooks/user/use-language-switch", () => ({
  useLanguageSwitch: () => ({
    cycleLocale: mockCycleLocale,
    icon: null,
    isChanging: false,
    label: "English",
    mounted: true,
  }),
}));

vi.mock("@/components/shared/import-recipe-modal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Import recipe modal</div> : null),
}));

vi.mock("@/components/shared/user-avatar", () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@heroui/react", async () => {
  const React = await import("react");

  type DropdownContextValue = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
  };

  const DropdownContext = React.createContext<DropdownContextValue>({
    isOpen: false,
    onOpenChange: () => {},
  });

  function Button({
    children,
    onPress,
    type = "button",
    ...props
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    type?: "button" | "submit" | "reset";
    [key: string]: unknown;
  }) {
    const dropdown = React.useContext(DropdownContext);
    const ariaLabel = props["aria-label"] as string | undefined;

    return (
      <button
        aria-label={ariaLabel}
        type={type}
        onClick={() => {
          if (ariaLabel === "Open user menu") {
            dropdown.onOpenChange(!dropdown.isOpen);
          }
          onPress?.();
        }}
      >
        {children}
      </button>
    );
  }

  function DropdownRoot({
    children,
    isOpen,
    onOpenChange,
  }: {
    children: React.ReactNode;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) {
    const value = {
      isOpen: Boolean(isOpen),
      onOpenChange: onOpenChange ?? (() => {}),
    };

    return (
      <DropdownContext.Provider value={value}>
        <div data-open={String(value.isOpen)}>{children}</div>
      </DropdownContext.Provider>
    );
  }

  function Popover({ children }: { children: React.ReactNode }) {
    const dropdown = React.useContext(DropdownContext);

    return dropdown.isOpen ? <div role="menu">{children}</div> : null;
  }

  function Menu({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function Item({
    children,
    onPress,
    textValue,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    textValue?: string;
  }) {
    const dropdown = React.useContext(DropdownContext);

    return (
      <button
        aria-label={textValue}
        role="menuitem"
        type="button"
        onClick={() => {
          onPress?.();
          dropdown.onOpenChange(false);
        }}
      >
        {children}
      </button>
    );
  }

  const Dropdown = Object.assign(DropdownRoot, {
    Item,
    Menu,
    Popover,
  });

  return {
    Button,
    Dropdown,
    Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  };
});

describe("NavbarUserMenu open state", () => {
  it("opens only the clicked instance when desktop and mobile menus are both mounted", () => {
    render(
      <>
        <NavbarUserMenu />
        <NavbarUserMenu />
      </>
    );

    const triggers = screen.getAllByLabelText("Open user menu");

    fireEvent.click(triggers[0]);

    expect(screen.getAllByRole("menu")).toHaveLength(1);
    expect(screen.getAllByRole("menuitem", { name: "logout" })).toHaveLength(1);
  });
});
