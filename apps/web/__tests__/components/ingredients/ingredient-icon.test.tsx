/**
 * An Ingredient Icon beside a food's name: the icon the surface read for the
 * food, or one given outright, else nothing (an empty slot only while the
 * read is on its way, a muted placeholder only where asked for); and nothing
 * at all, slot included, for a reader who hid Ingredient Icons.
 */
import type { ReactNode } from "react";
import { IngredientIcon, IngredientIconsProvider } from "@/components/ingredients/ingredient-icon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ONION = "11111111-1111-4111-8111-111111111111";
const KOHLRABI = "22222222-2222-4222-8222-222222222222";
const ONION_ICON = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";

const mocks = vi.hoisted(() => ({
  hidden: [] as string[],
  asked: [] as unknown[],
}));

vi.mock("@/context/device-preferences-context", async () =>
  (await import("../../helpers/device-preferences-mock")).mockDevicePreferences(() => ({
    hiddenItems: mocks.hidden,
  }))
);

vi.mock("@/app/providers/trpc-provider", () => ({
  useTRPC: () => ({
    ingredients: {
      icons: {
        queryOptions: (input: { ids: string[] }) => ({
          queryKey: ["ingredients.icons", input],
          queryFn: async () => {
            mocks.asked.push(input);

            return Object.fromEntries(
              input.ids.map((id) => [id, id === ONION ? ONION_ICON : null])
            );
          },
        }),
      },
    },
  }),
}));

function onSurface(ids: (string | null)[], children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <IngredientIconsProvider ids={ids}>{children}</IngredientIconsProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.hidden = [];
  mocks.asked = [];
});

describe("IngredientIcon", () => {
  it("shows each food's icon from one read for the whole surface, nothing where it has none", async () => {
    const { container } = onSurface(
      [ONION, KOHLRABI, null],
      <>
        <IngredientIcon ingredientId={ONION} />
        <IngredientIcon ingredientId={KOHLRABI} />
        {/* A line the server has not resolved yet. */}
        <IngredientIcon ingredientId={null} />
      </>
    );

    expect((await screen.findByTestId("ingredient-icon")).getAttribute("src")).toBe(ONION_ICON);
    await waitFor(() => expect(container.childElementCount).toBe(1));
    expect(mocks.asked).toEqual([{ ids: [ONION, KOHLRABI].sort() }]);
  });

  it("holds an empty slot while the read is on its way, so the line does not jump", async () => {
    const { container } = onSurface([ONION], <IngredientIcon ingredientId={ONION} />);

    expect(container.querySelector("span[aria-hidden]")).not.toBeNull();
    expect(screen.queryByTestId("ingredient-icon-placeholder")).toBeNull();
    expect(await screen.findByTestId("ingredient-icon")).toBeInTheDocument();
  });

  it("shows an icon given outright, with no read", () => {
    onSurface([], <IngredientIcon src={ONION_ICON} />);

    expect(screen.getByTestId("ingredient-icon").getAttribute("src")).toBe(ONION_ICON);
    expect(mocks.asked).toEqual([]);
  });

  it("shows a muted placeholder for no icon only where asked, as the panel field does", () => {
    const { container } = onSurface(
      [],
      <>
        <IngredientIcon src={null} />
        <IngredientIcon placeholder size="panel" src={null} />
      </>
    );

    expect(container.childElementCount).toBe(1);
    expect(screen.getByTestId("ingredient-icon-placeholder")).toHaveClass("size-16");
  });

  it("shows nothing, placeholder and slot included, to a reader who hid Ingredient Icons", () => {
    mocks.hidden = ["ingredientIcons"];
    const { container } = onSurface(
      [ONION],
      <>
        <IngredientIcon ingredientId={ONION} />
        <IngredientIcon placeholder src={null} />
      </>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
