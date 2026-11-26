// The Content tab's routes: the old Ingredients address redirects to the list with its query, the
// bare address to Tags, an unknown list is not found; the list picker links every list.
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import ContentListPage from "@/app/(app)/settings/content/[list]/page";
import ContentSettingsPage from "@/app/(app)/settings/content/page";
import IngredientsSettingsPage from "@/app/(app)/settings/ingredients/page";
import { ContentNav } from "@/features/content/content-nav";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ number: (value: number) => value.toLocaleString("en") }),
}));
vi.mock("@norish/shared-react/lists", async (importActual) => ({
  ...(await importActual<object>()),
  useContentCounts: () => ({ tag: 89, cuisine: 32, category: 6, ingredient: 1204 }),
}));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: () => undefined }));
vi.mock("@/features/ingredients/ingredients-screen", () => ({ IngredientsScreen: () => null }));
vi.mock("@/features/content/content-screen", () => ({
  ContentScreen: ({ list, ingredients }: { list: string; ingredients: ReactNode }) => (
    <div data-list={list}>{ingredients}</div>
  ),
}));

describe("the old Ingredients address", () => {
  it("redirects to the Ingredients list and keeps a deep link's query", async () => {
    await expect(
      IngredientsSettingsPage({ searchParams: Promise.resolve({ ingredient: "abc" }) })
    ).rejects.toThrow("redirect:/settings/content/ingredients?ingredient=abc");
    await expect(IngredientsSettingsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "redirect:/settings/content/ingredients"
    );
  });
});

describe("the Content routes", () => {
  it("opens the bare address on Tags", () => {
    expect(() => ContentSettingsPage()).toThrow("redirect:/settings/content/tags");
  });

  it("serves a list by its name in the address, and refuses another", async () => {
    const page = await ContentListPage({ params: Promise.resolve({ list: "cuisines" }) });

    render(page);
    expect(document.querySelector("[data-list=cuisines]")).toBeInTheDocument();
    await expect(ContentListPage({ params: Promise.resolve({ list: "nope" }) })).rejects.toThrow(
      "not-found"
    );
  });
});

describe("the list picker", () => {
  it("links every list by its address, marks the chosen one and counts the entries", () => {
    render(<ContentNav list="cuisines" />);

    const tabs = screen.getAllByRole("tab");

    expect(tabs.map((tab) => tab.getAttribute("href"))).toEqual([
      "/settings/content/tags",
      "/settings/content/cuisines",
      "/settings/content/categories",
      "/settings/content/ingredients",
    ]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[0]).toHaveTextContent("89");
    expect(tabs[3]).toHaveTextContent("1,204");
  });
});
