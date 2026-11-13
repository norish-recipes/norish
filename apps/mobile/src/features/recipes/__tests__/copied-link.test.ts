import { copiedLinkToOffer } from "@/features/recipes/utils/copied-link";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/auth-headers", () => ({ authHeaders: () => ({}) }));
vi.mock("@/lib/network/server-address", async () => ({
  ServerAddressContext: (await import("react")).createContext(null),
}));

const SERVER = "https://norish.example.com";
const RECIPE = "https://www.seriouseats.com/hoisin-chicken-recipe";

describe("copiedLinkToOffer", () => {
  it("offers a copied recipe link", () => {
    expect(copiedLinkToOffer({ hasUrl: true, url: RECIPE, serverAddress: SERVER })).toBe(RECIPE);
  });

  it("offers it without the spaces around it", () => {
    expect(copiedLinkToOffer({ hasUrl: true, url: ` ${RECIPE}\n`, serverAddress: SERVER })).toBe(
      RECIPE
    );
  });

  it("offers nothing when the clipboard holds no URL", () => {
    expect(copiedLinkToOffer({ hasUrl: false, url: null, serverAddress: SERVER })).toBeNull();
    expect(copiedLinkToOffer({ hasUrl: false, url: RECIPE, serverAddress: SERVER })).toBeNull();
  });

  it("offers nothing for a URL that is not a web link", () => {
    for (const url of ["mailto:cook@example.com", "norish://recipe/1", "", null]) {
      expect(copiedLinkToOffer({ hasUrl: true, url, serverAddress: SERVER })).toBeNull();
    }
  });

  it("offers nothing for a link into the own server", () => {
    expect(
      copiedLinkToOffer({ hasUrl: true, url: `${SERVER}/recipes/1`, serverAddress: SERVER })
    ).toBeNull();
  });

  it("offers a link on a host that only starts like the own server", () => {
    const lookalike = `${SERVER}.evil.test/soup`;

    expect(copiedLinkToOffer({ hasUrl: true, url: lookalike, serverAddress: SERVER })).toBe(
      lookalike
    );
  });

  it("offers a web link while no Server Address is known", () => {
    expect(copiedLinkToOffer({ hasUrl: true, url: RECIPE, serverAddress: null })).toBe(RECIPE);
  });
});
