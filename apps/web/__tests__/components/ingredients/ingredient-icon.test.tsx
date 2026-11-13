/**
 * An Ingredient Icon beside a food's name: the icon the surface read for the
 * food, or one given outright, else nothing (an empty slot only while the
 * read is on its way, a muted food glyph only where asked for); and nothing
 * at all, slot included, for a reader who hid Ingredient Icons.
 */
import type { ReactNode } from "react";
import { Profiler } from "react";
import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";
import { useIngredientIcons } from "@norish/shared-react/ingredients";
import { createOfflineQueryClient } from "@norish/shared-react/offline";
import { createTestQueryClient } from "@norish/shared-react/platform/testing";

const ONION = "11111111-1111-4111-8111-111111111111";
const KOHLRABI = "22222222-2222-4222-8222-222222222222";
const ONION_ICON = "/ingredient-icons/0123456789abcdef0123456789abcdef.webp";
const KOHLRABI_ICON = "/ingredient-icons/fedcba9876543210fedcba9876543210.webp";

const mocks = vi.hoisted(() => ({
  hidden: [] as string[],
  asked: [] as unknown[],
  icons: {} as Record<string, string | null>,
  // A read that never answers, as one does Offline.
  stalled: false,
}));

vi.mock("@norish/shared-react/reader", async () =>
  (await import("../../helpers/reader-mock")).mockDevicePreferences(() => ({
    hiddenItems: mocks.hidden,
  }))
);

vi.mock("@norish/shared-react/trpc", async () => {
  const { QueryClient } = await import("@tanstack/react-query");
  const { createTRPCClient } = await import("@trpc/client");
  const { createTRPCOptionsProxy } = await import("@trpc/tanstack-react-query");
  // The app's own keys, so the offline cache's defaults match them.
  const keys = createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({ links: [] }),
    queryClient: new QueryClient(),
  }).ingredients.icons;
  const icons = {
    pathKey: () => keys.pathKey(),
    queryOptions: (input: { ids: string[] }) => ({
      queryKey: keys.queryKey(input),
      queryFn: async () => {
        mocks.asked.push(input);
        if (mocks.stalled) await new Promise(() => {});

        return Object.fromEntries(input.ids.map((id) => [id, mocks.icons[id] ?? null]));
      },
    }),
  };

  return { useTRPC: () => ({ ingredients: { icons } }) };
});

/** A surface: one read of its foods' icons, and whatever it draws. */
function Surface({ ids, children }: { ids: (string | null)[]; children: ReactNode }) {
  useIngredientIcons(ids);

  return children;
}

function onSurface(ids: (string | null)[], children: ReactNode, client = createTestQueryClient()) {
  const view = render(
    <QueryClientProvider client={client}>
      <Surface ids={ids}>{children}</Surface>
    </QueryClientProvider>
  );

  return {
    ...view,
    rerenderSurface: (next: (string | null)[], nextChildren: ReactNode) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Surface ids={next}>{nextChildren}</Surface>
        </QueryClientProvider>
      ),
  };
}

beforeEach(() => {
  mocks.hidden = [];
  mocks.asked = [];
  mocks.stalled = false;
  mocks.icons = { [ONION]: ONION_ICON };
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
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

  it("draws the icon of a food joining the surface, and the icons already shown not again", async () => {
    mocks.icons[KOHLRABI] = KOHLRABI_ICON;
    const renders: Record<string, number> = { onion: 0, kohlrabi: 0 };
    const counted = (id: string, icon: ReactNode) => (
      <Profiler id={id} onRender={() => (renders[id] = (renders[id] ?? 0) + 1)}>
        {icon}
      </Profiler>
    );
    // The same element on every render, as the compiler keeps an unchanged row's.
    const onion = counted("onion", <IngredientIcon ingredientId={ONION} />);
    const { rerenderSurface } = onSurface([ONION], onion);

    expect((await screen.findByTestId("ingredient-icon")).getAttribute("src")).toBe(ONION_ICON);
    const onionRenders = renders.onion;

    rerenderSurface(
      [ONION, KOHLRABI],
      <>
        {onion}
        {counted("kohlrabi", <IngredientIcon ingredientId={KOHLRABI} />)}
      </>
    );

    await waitFor(() => expect(screen.getAllByTestId("ingredient-icon")).toHaveLength(2));
    expect(screen.getAllByTestId("ingredient-icon")[1]).toHaveAttribute("src", KOHLRABI_ICON);
    expect(renders.onion).toBe(onionRenders);
  });

  it("prefers the surface's own read to an older one, whatever clock stamped that", async () => {
    const client = createTestQueryClient();
    const keys = (await import("@norish/shared-react/trpc")).useTRPC().ingredients.icons;

    // A seed from a server whose clock runs an hour ahead, for a set the surface no longer shows.
    client.setQueryData(
      keys.queryOptions({ ids: [ONION] }).queryKey,
      { [ONION]: KOHLRABI_ICON },
      { updatedAt: Date.now() + 60 * 60 * 1000 }
    );
    onSurface([ONION, KOHLRABI], <IngredientIcon ingredientId={ONION} />, client);

    await waitFor(() => expect(mocks.asked).toHaveLength(1));
    await waitFor(() =>
      expect(screen.getByTestId("ingredient-icon").getAttribute("src")).toBe(ONION_ICON)
    );
  });

  it("keeps the previous read's icons past the default gcTime while a changed set stays unread", async () => {
    mocks.icons[KOHLRABI] = KOHLRABI_ICON;
    const { rerenderSurface } = onSurface(
      [ONION, KOHLRABI],
      <IngredientIcon ingredientId={ONION} />,
      createOfflineQueryClient()
    );

    expect((await screen.findByTestId("ingredient-icon")).getAttribute("src")).toBe(ONION_ICON);

    // Offline, a grocery is deleted: the surface's new read never answers.
    vi.useFakeTimers();
    mocks.stalled = true;
    rerenderSurface([ONION], <IngredientIcon ingredientId={ONION} />);
    await act(() => vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1));

    expect(screen.getByTestId("ingredient-icon").getAttribute("src")).toBe(ONION_ICON);
  });

  it("prefixes its address when the app is served under a base path", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/norish");
    vi.resetModules();
    const { IngredientIcon: BasedIngredientIcon } =
      await import("@/components/ingredients/ingredient-icon");

    render(<BasedIngredientIcon src={ONION_ICON} />);

    expect(screen.getByTestId("ingredient-icon")).toHaveAttribute("src", `/norish${ONION_ICON}`);
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

  it("shows a muted food glyph for no icon only where asked, as the list and panel do", () => {
    const { container } = onSurface(
      [],
      <>
        <IngredientIcon src={null} />
        <IngredientIcon placeholder size="panel" src={null} />
      </>
    );

    expect(container.childElementCount).toBe(1);
    expect(screen.getByTestId("ingredient-icon-placeholder")).toHaveClass("size-16");
    expect(screen.getByTestId("ingredient-icon-placeholder").querySelector("svg")).not.toBeNull();
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
