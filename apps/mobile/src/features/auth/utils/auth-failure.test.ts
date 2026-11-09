import { describe, expect, it } from "vitest";

import { authFailure } from "./auth-failure";

describe("authFailure", () => {
  it("is null once the call succeeds", async () => {
    await expect(authFailure(Promise.resolve({ error: null }), "refused")).resolves.toBeNull();
  });

  it("is a refusal's own message, or the refused text without one", async () => {
    await expect(
      authFailure(Promise.resolve({ error: { message: "Invalid password" } }), "refused")
    ).resolves.toBe("Invalid password");
    await expect(authFailure(Promise.resolve({ error: {} }), "refused")).resolves.toBe("refused");
  });

  it("is a thrown error's message, or the failed text without one", async () => {
    await expect(
      authFailure(Promise.reject(new Error("Network request failed")), "refused", "failed")
    ).resolves.toBe("Network request failed");
    await expect(authFailure(Promise.reject(new Error("")), "refused", "failed")).resolves.toBe(
      "failed"
    );
    await expect(authFailure(Promise.reject("offline"), "refused")).resolves.toBe("refused");
  });
});
