import { describe, expect, it } from "vitest";

import { isValidEmail } from "@norish/shared/lib/email";

describe("isValidEmail", () => {
  it("accepts what the server's z.email() accepts", () => {
    expect(isValidEmail("User.Name+tag@sub.example.com")).toBe(true);
  });

  it("refuses what it refuses", () => {
    for (const email of ["a@b.c", "a@münchen.de", "user@nas", "ada@", "a b@example.com", ""]) {
      expect(isValidEmail(email)).toBe(false);
    }
  });
});
