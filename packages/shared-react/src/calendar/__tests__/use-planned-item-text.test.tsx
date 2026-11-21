import type { ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";

import { usePlannedItemText } from "../use-planned-item-text";

const adapter = fakePlatformAdapter();

const wrapper = ({ children }: { children: ReactNode }) => (
  <PlatformProvider adapter={adapter}>{children}</PlatformProvider>
);

describe("usePlannedItemText", () => {
  it("titles and subtitles an item with the app's labels", () => {
    const { result } = renderHook(() => usePlannedItemText(), { wrapper });
    const pasta = { itemType: "recipe", recipeName: "Pasta", servings: 2, calories: null };

    expect(result.current(pasta as PlannedItemFromQuery)).toEqual({
      title: "Pasta",
      subtitle: "2 calendar.timeline.servings",
    });
    expect(result.current(undefined)).toEqual({
      title: "calendar.timeline.untitled",
      subtitle: null,
    });
  });
});
