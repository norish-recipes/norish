import { authFailure, signInFailure } from "@/features/auth/utils/auth-failure";
import { describe, expect, it } from "vitest";

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

describe("signInFailure", () => {
  it("says wrong email or password for Better Auth's credentials refusal", async () => {
    await expect(
      signInFailure(
        Promise.resolve({
          error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" },
        }),
        "wrong",
        "refused"
      )
    ).resolves.toBe("wrong");
  });

  it("maps every other failure as authFailure does", async () => {
    await expect(
      signInFailure(
        Promise.resolve({ error: { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" } }),
        "wrong",
        "refused"
      )
    ).resolves.toBe("Email not verified");
    await expect(
      signInFailure(Promise.reject(new Error("Network request failed")), "wrong", "refused")
    ).resolves.toBe("Network request failed");
    await expect(
      signInFailure(Promise.resolve({ error: null }), "wrong", "refused")
    ).resolves.toBeNull();
  });
});
