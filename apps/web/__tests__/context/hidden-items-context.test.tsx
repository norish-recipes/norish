import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import type { User } from "@norish/shared/contracts";

import { HiddenItemsProvider, useHiddenItems } from "@/context/hidden-items-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";
import { HIDDEN_ITEMS_MIRROR_KEY, readHiddenItemsMirror } from "@/lib/hidden-items-mirror";
import { CACHE_OWNER_STORAGE_KEY } from "@/lib/query-cache/cache-identity";

const mocks = vi.hoisted(() => ({
  user: null as Partial<User> | null,
}));

vi.mock("@/context/user-context", () => ({
  useUserContext: () => ({ user: mocks.user }),
}));

function Probe() {
  const hidden = useHiddenItems();

  return <span data-testid="hidden">{JSON.stringify(hidden)}</span>;
}

/** The session-derived user: no `preferences` key — the list is not yet known. */
const SESSION_USER: Partial<User> = { id: "reader-1", email: "r@example.com", name: "Reader" };

beforeEach(() => {
  window.localStorage.clear();
  mocks.user = null;
});

describe("the hidden list is known from the first frame", () => {
  it("seeds from the server pass while the live user is still session-only", () => {
    mocks.user = SESSION_USER;

    render(
      <HiddenItemsProvider initialHiddenItems={["rating", "favorites"]}>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["rating","favorites"]');
  });

  it("falls back to the device mirror when nothing was seeded (offline shell)", () => {
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, "reader-1");
    window.localStorage.setItem(
      HIDDEN_ITEMS_MIRROR_KEY,
      JSON.stringify({ owner: "reader-1", hidden: ["nutrition"] })
    );
    mocks.user = SESSION_USER;

    render(
      <HiddenItemsProvider>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["nutrition"]');
  });

  it("ignores a mirror written for a different account", () => {
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, "reader-2");
    window.localStorage.setItem(
      HIDDEN_ITEMS_MIRROR_KEY,
      JSON.stringify({ owner: "reader-1", hidden: ["nutrition"] })
    );
    mocks.user = null;

    render(
      <HiddenItemsProvider>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent("[]");
  });

  it("lets the live preferences take over and refreshes the mirror", () => {
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, "reader-1");
    mocks.user = { ...SESSION_USER, preferences: { hidden: ["notes"] } };

    render(
      <HiddenItemsProvider initialHiddenItems={["rating"]}>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent('["notes"]');
    expect(readHiddenItemsMirror()).toEqual(["notes"]);
  });

  it("drives visibility from the persisted list before any network answer (offline shell)", () => {
    // The offline bootstrap mounts the shell with no server seed and no
    // network: the mirror alone must decide what the first frame shows.
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, "reader-1");
    window.localStorage.setItem(
      HIDDEN_ITEMS_MIRROR_KEY,
      JSON.stringify({ owner: "reader-1", hidden: ["rating", "favorites"] })
    );
    mocks.user = null;

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

  it("renders everything when nothing is seeded, mirrored, or stored", () => {
    mocks.user = { ...SESSION_USER, preferences: {} };

    render(
      <HiddenItemsProvider>
        <Probe />
      </HiddenItemsProvider>
    );

    expect(screen.getByTestId("hidden")).toHaveTextContent("[]");
  });
});
