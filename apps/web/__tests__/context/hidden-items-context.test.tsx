import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import "@testing-library/jest-dom";

import {
  HiddenItemsProvider,
  useHiddenItems,
  useHiddenItemsState,
} from "@/context/hidden-items-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { hiddenItemsPreference } from "@/lib/hidden-items";

function Probe() {
  const hidden = useHiddenItems();

  return <span data-testid="hidden">{JSON.stringify(hidden)}</span>;
}

beforeEach(() => {
  document.cookie = `${hiddenItemsPreference.cookieName}=;path=/;max-age=0`;
});

describe("the hidden list is known from the first frame", () => {
  it("seeds from the server pass over the request's cookie", () => {
    render(
      <HiddenItemsProvider initialHiddenItems={["rating", "favorites"]}>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["rating","favorites"]');
  });

  it("self-reads the cookie when nothing was seeded (offline shell)", () => {
    hiddenItemsPreference.writeCookie(["nutrition"]);

    render(
      <HiddenItemsProvider>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["nutrition"]');
  });

  it("settles on the cookie when the seeded document was stale (service-worker HTML)", () => {
    // The service worker can answer a navigation with cached HTML whose
    // seed predates the last toggle; the cookie is the current truth.
    hiddenItemsPreference.writeCookie(["notes"]);

    render(
      <HiddenItemsProvider initialHiddenItems={["rating"]}>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["notes"]');
  });

  it("drives visibility from the cookie before any network answer (offline shell)", () => {
    hiddenItemsPreference.writeCookie(["rating", "favorites"]);

    function VisibilityProbe() {
      const { showRatings, showFavorites, showNotes } = useHiddenItemVisibility();

      return <span data-testid="flags">{`${showRatings}:${showFavorites}:${showNotes}`}</span>;
    }

    render(
      <HiddenItemsProvider>
        <VisibilityProbe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("flags")).toHaveTextContent("false:false:true");
  });

  it("renders everything when nothing is seeded or stored", () => {
    render(
      <HiddenItemsProvider>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent("[]");
  });

  it("applies a settings change immediately and persists it to the cookie", () => {
    function Writer() {
      const [, setHidden] = useHiddenItemsState();

      return (
        <button type="button" onClick={() => setHidden(["conversion"])}>
          hide
        </button>
      );
    }

    render(
      <HiddenItemsProvider initialHiddenItems={[]}>
        <Writer />
        <Probe />
      </HiddenItemsProvider>
    );

    act(() => screen.getByRole("button", { name: "hide" }).click());

    expect(screen.getByTestId("hidden")).toHaveTextContent('["conversion"]');
    expect(hiddenItemsPreference.readCookie()).toEqual(["conversion"]);
  });
});
