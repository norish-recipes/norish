// Add on the Ingredients list: the foods the name finds, Add only for a name no food has, and
// the food the server answers opening its panel.
import type { ReactNode } from "react";
import { readAnswers, sentWrites, writeAnswers } from "@/__tests__/helpers/trpc-fake";
import { IngredientAddPanel } from "@/features/ingredients/components/ingredient-add-panel";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { ConnectivityProvider } from "@norish/shared-react/offline/react";
import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("@norish/shared-react/realtime", () => ({ useRealtimeSubscription: () => undefined }));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
  useLocale: () => "en",
}));
vi.mock("@/components/ingredients/ingredient-icon", () => ({ IngredientIcon: () => null }));
vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({
    children,
    open,
    title,
  }: {
    children?: ReactNode;
    open?: boolean;
    title?: string;
  }) =>
    open ? (
      <div aria-label={title} role="dialog">
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  Panel.Footer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: ReactNode }) => children };
});

const food = (id: string, name: string) => ({ id, name, localeNames: {}, icon: null });

beforeEach(() => {
  readAnswers.clear();
  writeAnswers.clear();
  sentWrites.mockClear();
  readAnswers.set("ingredients.list", async (input) => {
    const search = (input as { search: string }).search.toLowerCase();

    return {
      items: [food("1", "Sesame oil"), food("2", "Sesame seeds")].filter((item) =>
        item.name.toLowerCase().includes(search)
      ),
      nextCursor: null,
    };
  });
});

function renderPanel(offline = false) {
  const onOpenFood = vi.fn();
  const onOpenChange = vi.fn();
  const base = createTestWrapper(createTestQueryClient(), fakePlatformAdapter());
  const wrapper = ({ children }: { children: ReactNode }) =>
    base({
      children: offline ? (
        <ConnectivityProvider
          forced
          probe={async () => false}
          subscribeHints={() => () => {}}
          wsStatus="disconnected"
        >
          {children}
        </ConnectivityProvider>
      ) : (
        children
      ),
    });

  render(<IngredientAddPanel open onOpenChange={onOpenChange} onOpenFood={onOpenFood} />, {
    wrapper,
  });

  return { onOpenFood, onOpenChange };
}

describe("IngredientAddPanel", () => {
  it("lists the foods the name finds and offers Add for a name no food has", async () => {
    renderPanel();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("panel.addTitle.ingredient");
    expect(screen.getByTestId("content-add-submit")).toBeDisabled();
    await userEvent.type(screen.getByTestId("content-add-name"), "sesame");
    await waitFor(() => expect(screen.getAllByTestId("content-add-match")).toHaveLength(2));
    expect(screen.getByText("panel.already.ingredient")).toBeVisible();
    await waitFor(() => expect(screen.getByTestId("content-add-submit")).toBeEnabled());
  });

  it("offers no Add for a name a food has, whatever its case", async () => {
    renderPanel();
    await userEvent.type(screen.getByTestId("content-add-name"), "SESAME OIL");
    await waitFor(() => expect(screen.getAllByTestId("content-add-match")).toHaveLength(1));
    expect(screen.getByTestId("content-add-submit")).toBeDisabled();
  });

  it("adds through ingredients.add, closes, and opens the food it answers", async () => {
    writeAnswers.set("ingredients.add", async () => ({
      created: true,
      ingredient: food("9", "Sesame paste"),
    }));

    const { onOpenFood, onOpenChange } = renderPanel();

    await userEvent.type(screen.getByTestId("content-add-name"), "Sesame paste");
    await waitFor(() => expect(screen.getByTestId("content-add-submit")).toBeEnabled());
    await userEvent.click(screen.getByTestId("content-add-submit"));

    await waitFor(() => expect(onOpenFood).toHaveBeenCalledWith("9"));
    expect(sentWrites).toHaveBeenCalledWith("ingredients.add", {
      name: "Sesame paste",
      locale: "en",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens a food found under the name instead of adding", async () => {
    const { onOpenFood } = renderPanel();

    await userEvent.type(screen.getByTestId("content-add-name"), "sesame");
    await waitFor(() => expect(screen.getAllByTestId("content-add-match")).toHaveLength(2));
    await userEvent.click(screen.getAllByTestId("content-add-match")[1]!);
    expect(onOpenFood).toHaveBeenCalledWith("2");
    expect(sentWrites).not.toHaveBeenCalled();
  });

  it("says a name over the server's bound, and does not add offline", async () => {
    renderPanel();
    await userEvent.click(screen.getByTestId("content-add-name"));
    await userEvent.paste("x".repeat(301));
    expect(screen.getByText(/panel.tooLong/)).toBeVisible();
    expect(screen.getByTestId("content-add-submit")).toBeDisabled();
  });

  it("is off offline", async () => {
    renderPanel(true);
    await userEvent.type(screen.getByTestId("content-add-name"), "Sesame paste");
    await waitFor(() => expect(screen.getByText("offline")).toBeVisible());
    expect(screen.getByTestId("content-add-submit")).toBeDisabled();
  });
});
