import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { useHiddenItems, useHiddenItemsState } from "@/context/hidden-items-context";
import { useHiddenItemVisibility } from "@/hooks/user/use-hidden-item-visibility";

import { renderWithDevicePreferences, deviceWrite as write } from "../helpers/device-preferences";

vi.mock("@/app/providers/trpc-provider", () => import("../helpers/device-preferences-trpc"));

function renderWithHidden(hiddenItems: string[], children: React.ReactNode) {
  renderWithDevicePreferences(children, { values: { hiddenItems } });
}

function Probe() {
  return <span data-testid="hidden">{JSON.stringify(useHiddenItems())}</span>;
}

beforeEach(() => {
  write.mockReset().mockResolvedValue({ success: true });
});

describe("Hidden Items", () => {
  it("drive visibility from the first frame", () => {
    function VisibilityProbe() {
      const { showRatings, showFavorites, showNotes } = useHiddenItemVisibility();

      return <span data-testid="flags">{`${showRatings}:${showFavorites}:${showNotes}`}</span>;
    }

    renderWithHidden(["rating", "favorites"], <VisibilityProbe />);

    expect(screen.getByTestId("flags")).toHaveTextContent("false:false:true");
  });

  it("apply a settings change at once and save the whole list, carried entries included", async () => {
    function Writer() {
      const [, setHidden] = useHiddenItemsState();

      return (
        <button type="button" onClick={() => setHidden(["conversion", "fromANewerVersion"])}>
          hide
        </button>
      );
    }

    renderWithHidden(
      ["fromANewerVersion"],
      <>
        <Writer />
        <Probe />
      </>
    );

    act(() => screen.getByRole("button", { name: "hide" }).click());

    expect(screen.getByTestId("hidden")).toHaveTextContent('["conversion","fromANewerVersion"]');
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith(
        { kind: "phone", preferences: { hiddenItems: ["conversion", "fromANewerVersion"] } },
        expect.anything()
      )
    );
  });
});
