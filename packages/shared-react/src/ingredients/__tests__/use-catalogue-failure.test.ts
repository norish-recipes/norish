import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";

import { useCatalogueFailure } from "../use-catalogue-failure";

function setUp() {
  const platform = fakePlatformAdapter();
  const { result } = renderHook(() => useCatalogueFailure(), {
    wrapper: createTestWrapper(createTestQueryClient(), platform),
  });

  return { platform, failure: result.current };
}

describe("useCatalogueFailure", () => {
  it("says a catalogue refusal in its own words, else that something went wrong", () => {
    const { platform, failure } = setUp();

    failure.refuse(new Error("name-taken"), "save");
    failure.refuse(new Error("boom"), "save");

    expect(platform.toast.show).toHaveBeenNthCalledWith(1, {
      severity: "danger",
      title: "settings.ingredients.errors.title",
      description: "settings.ingredients.errors.name-taken",
    });
    expect(platform.toast.show).toHaveBeenNthCalledWith(2, {
      severity: "danger",
      title: "settings.ingredients.errors.title",
      description: "settings.ingredients.errors.unknown",
    });
  });

  it("says a nutrition refusal under the nutrition messages", () => {
    const { platform, failure } = setUp();

    failure.refuse(new Error("empty"), "correct-nutrition", "nutrition");
    failure.refuse(new Error("name-taken"), "correct-nutrition", "nutrition");

    expect(platform.toast.show).toHaveBeenNthCalledWith(1, {
      severity: "danger",
      title: "settings.ingredients.nutrition.errors.title",
      description: "settings.ingredients.nutrition.errors.empty",
    });
    expect(platform.toast.show).toHaveBeenNthCalledWith(2, {
      severity: "danger",
      title: "settings.ingredients.nutrition.errors.title",
      description: "settings.ingredients.nutrition.errors.unknown",
    });
  });

  it("says a failed write's own message under the catalogue's title", () => {
    const { platform, failure } = setUp();

    failure.fail(new Error("offline"), "upload-icon", "settings.ingredients.icon.failed");

    expect(platform.toast.show).toHaveBeenCalledWith({
      severity: "danger",
      title: "settings.ingredients.errors.title",
      description: "settings.ingredients.icon.failed",
    });
  });
});
