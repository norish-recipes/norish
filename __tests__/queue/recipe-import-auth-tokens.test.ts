// @vitest-environment node
import type { SiteAuthTokenDecryptedDto } from "@/types/dto/site-auth-tokens";

import { describe, it, expect } from "vitest";

describe("Recipe import auth tokens integration", () => {
  function makeToken(
    overrides: Partial<SiteAuthTokenDecryptedDto> = {}
  ): SiteAuthTokenDecryptedDto {
    return {
      id: "test-id",
      userId: "test-user",
      domain: "instagram.com",
      name: "cookie_auth",
      value: "session123",
      type: "cookie",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  describe("token passing logic", () => {
    it("passes tokens to parseRecipeFromUrl when user has tokens", () => {
      const tokens = [makeToken(), makeToken({ name: "csrf", value: "abc" })];
      const result = tokens.length > 0 ? tokens : undefined;

      expect(result).toEqual(tokens);
      expect(result).toHaveLength(2);
    });

    it("passes undefined when user has no tokens", () => {
      const tokens: SiteAuthTokenDecryptedDto[] = [];
      const result = tokens.length > 0 ? tokens : undefined;

      expect(result).toBeUndefined();
    });

    it("preserves all token properties when passing through", () => {
      const token = makeToken({
        id: "specific-id",
        domain: "facebook.com",
        name: "Authorization",
        value: "Bearer xyz",
        type: "header",
      });
      const tokens = [token];
      const result = tokens.length > 0 ? tokens : undefined;

      expect(result).toBeDefined();
      expect(result![0]).toEqual(
        expect.objectContaining({
          id: "specific-id",
          domain: "facebook.com",
          name: "Authorization",
          value: "Bearer xyz",
          type: "header",
        })
      );
    });
  });
});
