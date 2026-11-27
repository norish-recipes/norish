import { describe, expect, it } from "vitest";

import { signInMethodError } from "../../src/contracts/dto/auth";

describe("signInMethodError", () => {
  it("names a refusal by Better Auth's code", () => {
    expect(signInMethodError("LAST_SIGN_IN_METHOD", "removeFailed")).toBe("lastMethod");
    expect(signInMethodError("SESSION_NOT_FRESH", "removeFailed")).toBe("signInAgain");
    expect(signInMethodError("account_already_linked_to_different_user", "addFailed")).toBe(
      "usedByAnotherAccount"
    );
  });

  it("says the fallback for any other or no code", () => {
    expect(signInMethodError("SOMETHING_ELSE", "addFailed")).toBe("addFailed");
    expect(signInMethodError(undefined, "removeFailed")).toBe("removeFailed");
  });
});
